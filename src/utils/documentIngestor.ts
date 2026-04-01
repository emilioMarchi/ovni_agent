// Procesador de documentos para Firestore y Pinecone siguiendo la lógica RAG
// Soporta: pdf, txt, doc, docx, md, json, xlsx, xls, csv

import admin from "../server/firebase.js";
import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { extractTextFromFile } from "./extractText.js";

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "gemini-embedding-001",
  taskType: TaskType.RETRIEVAL_DOCUMENT,
  apiKey: process.env.GEMINI_API_KEY,
});
const chatModel = new ChatGoogleGenerativeAI({
  modelName: "gemini-2.5-flash",
  temperature: 0.2,
  apiKey: process.env.GEMINI_API_KEY,
});

type IngestDocumentParams = {
  filePath: string;
  clientId: string;
  docId: string;
  filename: string;
  description?: string;
  signal?: AbortSignal;
  onProgress?: (update: { stage: string; progress: number; message: string }) => Promise<void> | void;
};

type DocumentPart = {
  text: string;
  section_title?: string;
  summary?: string;
  keywords?: string[];
};

function extractMessageText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }

      if (item && typeof item === "object" && "text" in item && typeof item.text === "string") {
        return item.text;
      }

      return "";
    })
    .join("\n");
}

function repairAndParseJSON(raw: string): DocumentPart[] {
  // Intento directo
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {}

  // Intentar cerrar el JSON truncado
  let repaired = raw;

  // Si termina con una string sin cerrar, cerrarla
  const lastQuote = repaired.lastIndexOf('"');
  const afterLastQuote = repaired.slice(lastQuote + 1).trim();
  if (afterLastQuote === '' || afterLastQuote === ',') {
    repaired = repaired.slice(0, lastQuote + 1);
  }

  // Intentar cerrar objetos/arrays abiertos
  const closers = ['}"]', '}]', '"}]', '"]}]', ']'];
  for (const closer of closers) {
    try {
      const candidate = repaired.trimEnd().replace(/,\s*$/, '') + closer;
      const parsed = JSON.parse(candidate);
      console.log(`🔧 JSON reparado con closer: ${closer}`);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {}
  }

  // Último recurso: extraer todos los objetos completos que se puedan parsear
  const objects: DocumentPart[] = [];
  const regex = /\{(?:\s*"section_title"\s*:\s*"[\s\S]*?"\s*,)?\s*"text"\s*:\s*"[\s\S]*?"\s*,\s*"summary"\s*:\s*"[\s\S]*?"\s*,\s*"keywords"\s*:\s*\[[^\]]*\]\s*\}/g;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    try {
      objects.push(JSON.parse(match[0]));
    } catch {}
  }

  if (objects.length > 0) {
    console.log(`🔧 JSON rescatado parcialmente: ${objects.length} objetos extraídos por regex`);
    return objects;
  }

  throw new Error(`JSON irrecuperable (${raw.length} chars). Inicio: ${raw.slice(0, 200)}...`);
}

export async function processAndIngestDocument({ filePath, clientId, docId, filename, description, signal, onProgress }: IngestDocumentParams) {
  const db = admin.firestore();

  const checkAbort = () => {
    if (signal?.aborted) {
      throw new Error("CANCELLED");
    }
  };

  const reportProgress = async (stage: string, progress: number, message: string) => {
    checkAbort();
    if (onProgress) {
      await onProgress({ stage, progress, message });
    }
  };

  await reportProgress("extracting", 12, `Extrayendo contenido de ${filename}`);

  // 1. Extraer texto
  const text = await extractTextFromFile(filePath, filename);

  await reportProgress("analyzing", 28, `Contenido extraído (${text.length} caracteres). Analizando con Gemini...`);

  // 2. Pedir a Gemini que agrupe en secciones temáticas
  // Gemini 2.5 Flash soporta ~1M tokens (~4M chars). Agrupamos en lotes grandes para minimizar llamadas.
  const BATCH_SIZE = 100000; // ~100K chars por llamada Gemini (conservador)
  const textBatches: string[] = [];
  for (let i = 0; i < text.length; i += BATCH_SIZE) {
    textBatches.push(text.slice(i, i + BATCH_SIZE));
  }

  let allParts: DocumentPart[] = [];
  const batchResults: { batch: number; status: "ok" | "retry_ok" | "failed"; parts: number; error?: string; charRange?: string; contentPreview?: string }[] = [];
  
  for (let i = 0; i < textBatches.length; i++) {
    checkAbort();
    // Delay entre lotes para evitar rate limits de Gemini
    if (i > 0) await new Promise(r => setTimeout(r, 2000));
    const batch = textBatches[i];
    await reportProgress("analyzing", 28 + Math.round((i / textBatches.length) * 15), `Analizando lote ${i + 1} de ${textBatches.length}...`);
    
    const prompt = `Sos un experto en organización de documentos para búsqueda semántica (RAG).

Tu tarea es dividir el siguiente texto en fragmentos optimizados para recuperación semántica. Cada fragmento debe ser una UNIDAD LÓGICA del contenido.

REGLAS DE FRAGMENTACIÓN:
- Fragmentá por UNIDADES TEMÁTICAS: un artículo, una cláusula, un producto/servicio completo, una sección conceptual, una FAQ, etc.
- Si hay LISTAS DE ITEMS (productos, servicios, planes, precios): cada ítem debe ser un fragmento individual.
- Si un artículo o sección es muy corto (1-2 líneas), agrupalo con contenido relacionado adyacente.
- NO fragmentes a mitad de una idea. Es mejor un fragmento más largo que uno incompleto.
- Generá TODOS los fragmentos que el texto requiera, sin límite artificial.

CAMPOS POR FRAGMENTO:
- "section_title": Título jerárquico que ubique el fragmento en el documento (ej: "Productos > Agente Cognitivo", "Políticas > Devoluciones", "Art. 52 - Obligaciones del Vendedor"). Debe dar contexto de DÓNDE está este fragmento dentro del documento.
- "text": Texto ORIGINAL EXACTO del fragmento, copiado textualmente del documento. NO lo modifiques, resumas, parafrasees ni le agregues nada. Debe ser idéntico al original.
- "summary": Descripción clara de 1-3 oraciones de qué contiene este fragmento. Acá SÍ podés agregar contexto interpretativo (ej: "Este fragmento describe el producto Agente Cognitivo de OVNI Studio y sus características principales").
- "keywords": 5-10 términos clave para encontrar este fragmento. Incluí sinónimos y variaciones comunes que un usuario podría buscar.

Devolvé SOLO un JSON válido: [{"section_title":"...", "text":"...", "summary":"...", "keywords":["..."]}].

Texto del documento "${filename}":\n${batch}`;
    
    try {
      const result = await chatModel.invoke(prompt);
      const content = extractMessageText(result.content);
      const cleaned = content.replace(/```json|```/g, "").trim();
      const batchParts: DocumentPart[] = repairAndParseJSON(cleaned);
      allParts = allParts.concat(batchParts);
      batchResults.push({ batch: i + 1, status: "ok", parts: batchParts.length, charRange: `${i * BATCH_SIZE}-${Math.min((i + 1) * BATCH_SIZE, text.length)}` });
      console.log(`✅ Lote ${i + 1}/${textBatches.length} de ${filename}: ${batchParts.length} fragmentos`);
    } catch (e: any) {
      console.error(`❌ Error procesando lote ${i + 1}/${textBatches.length} de ${filename}:`, e?.message || e);
      await reportProgress("analyzing", 28 + Math.round((i / textBatches.length) * 15), `⚠️ Lote ${i + 1} falló, esperando antes de reintentar...`);
      // Esperar más en caso de rate limit
      const isRateLimit = e?.message?.includes('429') || e?.message?.includes('Too Many Requests') || e?.message?.includes('spending');
      await new Promise(r => setTimeout(r, isRateLimit ? 15000 : 3000));
      // Retry una vez con el mismo lote
      try {
        const retryResult = await chatModel.invoke(prompt);
        const retryContent = extractMessageText(retryResult.content);
        const retryCleaned = retryContent.replace(/```json|```/g, "").trim();
        const retryParts: DocumentPart[] = repairAndParseJSON(retryCleaned);
        allParts = allParts.concat(retryParts);
        batchResults.push({ batch: i + 1, status: "retry_ok", parts: retryParts.length, charRange: `${i * BATCH_SIZE}-${Math.min((i + 1) * BATCH_SIZE, text.length)}` });
        console.log(`✅ Lote ${i + 1}/${textBatches.length} (retry) de ${filename}: ${retryParts.length} fragmentos`);
      } catch (retryError: any) {
        const failStart = i * BATCH_SIZE;
        const failEnd = Math.min((i + 1) * BATCH_SIZE, text.length);
        const preview = textBatches[i].slice(0, 300).replace(/\n/g, ' ').trim();
        batchResults.push({ batch: i + 1, status: "failed", parts: 0, error: retryError?.message || "Error desconocido", charRange: `${failStart}-${failEnd}`, contentPreview: preview });
        console.error(`❌ Lote ${i + 1}/${textBatches.length} falló 2 veces, saltando. Rango chars: ${failStart}-${failEnd}`);
        console.error(`   Preview contenido perdido: ${preview}...`);
      }
    }
  }

  // Generar reporte de procesamiento
  const successBatches = batchResults.filter(b => b.status === "ok").length;
  const retryBatches = batchResults.filter(b => b.status === "retry_ok").length;
  const failedBatches = batchResults.filter(b => b.status === "failed");
  const totalBatches = textBatches.length;

  const processingReport = {
    totalBatches,
    successBatches,
    retryBatches,
    failedBatches: failedBatches.length,
    failedDetails: failedBatches.map(b => ({ batch: b.batch, error: b.error, charRange: b.charRange, contentPreview: b.contentPreview })),
    batchBreakdown: batchResults.map(b => ({ batch: b.batch, status: b.status, parts: b.parts, charRange: b.charRange })),
    totalFragments: allParts.length,
    totalChars: text.length,
    completeness: `${Math.round(((totalBatches - failedBatches.length) / totalBatches) * 100)}%`,
  };

  console.log(`\n📊 REPORTE DE PROCESAMIENTO: ${filename}`);
  console.log(`   Lotes: ${successBatches} OK | ${retryBatches} reintentos OK | ${failedBatches.length} fallidos | ${totalBatches} total`);
  console.log(`   Fragmentos extraídos: ${allParts.length}`);
  console.log(`   Completitud: ${processingReport.completeness}`);
  if (failedBatches.length > 0) {
    for (const fb of failedBatches) {
      console.log(`   ⚠️ Lote #${fb.batch} PERDIDO | Chars ${fb.charRange} | Error: ${fb.error}`);
      console.log(`     Contenido: ${fb.contentPreview}...`);
    }
  }
  // Log resumen por lote
  console.log(`   Detalle por lote:`);
  for (const b of batchResults) {
    const icon = b.status === "ok" ? "✅" : b.status === "retry_ok" ? "🔄" : "❌";
    console.log(`     ${icon} Lote #${b.batch}: ${b.parts} fragmentos | chars ${b.charRange}`);
  }

  if (allParts.length === 0) {
    throw new Error("No se pudo extraer ninguna parte relevante del documento.");
  }

  const reportSummary = failedBatches.length > 0
    ? `${allParts.length} fragmentos (${processingReport.completeness} completo, ${failedBatches.length} lote(s) fallido(s): ${failedBatches.map(b => `#${b.batch}`).join(", ")})`
    : `${allParts.length} fragmentos (100% completo)`;

  await reportProgress("structuring", 46, `Análisis listo: ${reportSummary}. Guardando metadata...`);

  // Generar keywords y descripción general para el documento
  const allKeywords = Array.from(new Set(allParts.flatMap((part) => Array.isArray(part.keywords) ? part.keywords : [])));
  const generalDescription = allParts.map((part) => (typeof part.summary === "string" ? part.summary : "")).filter(Boolean).join(" ").slice(0, 400);
  const finalDescription = description || generalDescription;

  // 3. Guardar metadata en knowledge_docs
  await db.collection("knowledge_docs").doc(docId).set({
    clientId,
    filename,
    description: finalDescription,
    keywords: allKeywords,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "processed",
    partsCount: allParts.length,
    processingReport,
  }, { merge: true });

  const index = pinecone.index("chatbot-knowledge");
  const namespace = `client_${clientId}`;

  // 4. Vectorizar la descripción del documento en document_catalog
  checkAbort();
  await reportProgress("catalog_index", 58, "Indexando catálogo documental en Pinecone...");
  const catalogText = `${filename}: ${finalDescription}. Keywords: ${allKeywords.join(", ")}`;
  const catalogVector = await embeddings.embedQuery(catalogText);
  await index.namespace("document_catalog").upsert([{
    id: docId,
    values: catalogVector,
    metadata: {
      clientId,
      docId,
      filename,
      description: finalDescription,
      keywords: allKeywords.join(", "),
    },
  }]);

  // 5. Guardar partes en knowledge_parts y Pinecone (en batch)
  await reportProgress("fragment_index", 65, `Indexando ${allParts.length} fragmentos en Pinecone (batch)...`);

  // Preparar textos enriquecidos para embedding batch (incluye contexto documental)
  const enrichedTexts = allParts.map((part) =>
    `[Documento: ${filename}] [Sección: ${part.section_title || "General"}]\n${part.text}\n\nResumen: ${part.summary || ""}\nPalabras clave: ${(part.keywords || []).join(", ")}`
  );

  // Embedding en batch (usa batchEmbedContents internamente, lotes de hasta 100)
  const vectors = await embeddings.embedDocuments(enrichedTexts);

  await reportProgress("fragment_index", 78, `Embeddings generados. Guardando en Firestore y Pinecone...`);

  // Firestore batch writes (máx 500 por batch)
  const FIRESTORE_BATCH_LIMIT = 400;
  for (let batchStart = 0; batchStart < allParts.length; batchStart += FIRESTORE_BATCH_LIMIT) {
    const batch = db.batch();
    const batchEnd = Math.min(batchStart + FIRESTORE_BATCH_LIMIT, allParts.length);
    
    for (let i = batchStart; i < batchEnd; i++) {
      const part = allParts[i];
      const partId = `part_${docId}_${i}`;
      const ref = db.collection("knowledge_parts").doc(partId);
      batch.set(ref, {
        docId,
        clientId,
        filename,
        section_title: part.section_title || "",
        text: part.text,
        summary: part.summary,
        keywords: part.keywords,
        createdAt: new Date().toISOString(),
        idx: i,
      });
    }
    await batch.commit();
  }

  // Pinecone upsert en lotes (máx 100 vectores por upsert)
  // Pinecone tiene límite de 40KB por vector metadata → truncar text
  const PINECONE_META_TEXT_LIMIT = 8000; // ~8KB para text, deja margen para otros campos
  const PINECONE_BATCH_LIMIT = 100;
  for (let batchStart = 0; batchStart < allParts.length; batchStart += PINECONE_BATCH_LIMIT) {
    const batchEnd = Math.min(batchStart + PINECONE_BATCH_LIMIT, allParts.length);
    const pineconeRecords = [];

    for (let i = batchStart; i < batchEnd; i++) {
      const part = allParts[i];
      const partId = `part_${docId}_${i}`;
      const metaText = part.text.length > PINECONE_META_TEXT_LIMIT
        ? part.text.slice(0, PINECONE_META_TEXT_LIMIT) + '...'
        : part.text;
      pineconeRecords.push({
        id: partId,
        values: vectors[i],
        metadata: {
          docId,
          clientId,
          filename,
          section_title: (part.section_title || "").slice(0, 200),
          description: (part.summary || "").slice(0, 500),
          text: metaText,
          keywords: (part.keywords || []).join(", ").slice(0, 500),
          idx: i,
        },
      });
    }

    await index.namespace(namespace).upsert(pineconeRecords);

    const fragmentProgress = Math.min(95, 78 + Math.round((batchEnd / allParts.length) * 17));
    await reportProgress("fragment_index", fragmentProgress, `Lote ${Math.ceil(batchEnd / PINECONE_BATCH_LIMIT)} indexado en Pinecone`);
  }

  await reportProgress("finalizing", 98, `Finalizando: ${reportSummary}`);
  console.log(`✅ Documento ingestado: ${filename} (${allParts.length} partes) → namespace: ${namespace}, document_catalog`);
  return { docId, partsCount: allParts.length, processingReport };
}
