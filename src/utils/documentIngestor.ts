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
  taskType: TaskType.RETRIEVAL_QUERY,
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
  onProgress?: (update: { stage: string; progress: number; message: string }) => Promise<void> | void;
};

type DocumentPart = {
  text: string;
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

export async function processAndIngestDocument({ filePath, clientId, docId, filename, description, onProgress }: IngestDocumentParams) {
  const db = admin.firestore();

  const reportProgress = async (stage: string, progress: number, message: string) => {
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
  
  for (let i = 0; i < textBatches.length; i++) {
    const batch = textBatches[i];
    await reportProgress("analyzing", 28 + Math.round((i / textBatches.length) * 15), `Analizando lote ${i + 1} de ${textBatches.length}...`);
    
    const prompt = `Sos un experto en organización de documentos para búsqueda semántica (RAG).

Tu tarea es dividir el siguiente texto en fragmentos relevantes para búsqueda semántica. Cada fragmento debe ser una unidad lógica del contenido (un artículo, una cláusula, un párrafo temático, una sección, etc.).

REGLAS:
- Fragmentá de forma GRANULAR: cada artículo, cláusula o párrafo temático debe ser un fragmento separado.
- Si un artículo o sección es muy corto (1-2 líneas), podés agruparlo con el siguiente relacionado.
- El "text" debe contener el texto ORIGINAL completo del fragmento (no lo resumas ni lo recortes).
- El "summary" debe describir de qué trata el fragmento en 1-2 oraciones.
- Las "keywords" deben ser 3-7 términos clave para encontrar este fragmento.
- Generá TODOS los fragmentos que el texto requiera, sin límite artificial.

Devuelve SOLO un JSON válido: [{text, summary, keywords:[]}]. Texto:\n${batch}`;
    
    try {
      const result = await chatModel.invoke(prompt);
      const content = extractMessageText(result.content);
      const cleaned = content.replace(/```json|```/g, "").trim();
      const batchParts: DocumentPart[] = JSON.parse(cleaned);
      allParts = allParts.concat(batchParts);
    } catch (e) {
      console.error(`Error procesando lote ${i} de ${filename}:`, e);
    }
  }

  if (allParts.length === 0) {
    throw new Error("No se pudo extraer ninguna parte relevante del documento.");
  }

  await reportProgress("structuring", 46, `Gemini devolvió un total de ${allParts.length} fragmentos. Guardando metadata...`);

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
  }, { merge: true });

  const index = pinecone.index("chatbot-knowledge");
  const namespace = `client_${clientId}`;

  // 4. Vectorizar la descripción del documento en document_catalog
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

  // Preparar textos enriquecidos para embedding batch
  const enrichedTexts = allParts.map((part) =>
    `${part.text}\n\nResumen: ${part.summary || ""}\nKeywords: ${(part.keywords || []).join(", ")}`
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
  const PINECONE_BATCH_LIMIT = 100;
  for (let batchStart = 0; batchStart < allParts.length; batchStart += PINECONE_BATCH_LIMIT) {
    const batchEnd = Math.min(batchStart + PINECONE_BATCH_LIMIT, allParts.length);
    const pineconeRecords = [];

    for (let i = batchStart; i < batchEnd; i++) {
      const part = allParts[i];
      const partId = `part_${docId}_${i}`;
      pineconeRecords.push({
        id: partId,
        values: vectors[i],
        metadata: {
          docId,
          clientId,
          filename,
          description: part.summary || "",
          text: part.text,
          keywords: (part.keywords || []).join(", "),
          idx: i,
        },
      });
    }

    await index.namespace(namespace).upsert(pineconeRecords);

    const fragmentProgress = Math.min(95, 78 + Math.round((batchEnd / allParts.length) * 17));
    await reportProgress("fragment_index", fragmentProgress, `Lote ${Math.ceil(batchEnd / PINECONE_BATCH_LIMIT)} indexado en Pinecone`);
  }

  await reportProgress("finalizing", 98, "Finalizando indexación y persistencia...");
  console.log(`✅ Documento ingestado: ${filename} (${allParts.length} partes) → namespace: ${namespace}, document_catalog`);
  return { docId, partsCount: allParts.length };
}
