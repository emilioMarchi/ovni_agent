import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import admin from "firebase-admin";
import { pushDebugEvent } from "../utils/debugCollector.js";

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "gemini-embedding-001",
  taskType: TaskType.RETRIEVAL_QUERY,
  apiKey: process.env.GEMINI_API_KEY,
});

function seemsProductQuery(query: string): boolean {
  return /(producto|productos|cat[aá]logo|precio|precios|plan|planes|destacado|destacados|sku|disponible|stock|presupuesto)/i.test(query);
}

async function searchProductsFallback(query: string, clientId: string) {
  const db = admin.firestore();
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter((word) => word.length > 2);

  const snapshot = await db.collection("products")
    .where("clientId", "==", clientId)
    .limit(20)
    .get();

  const matches = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((product: any) => {
      const searchText = `${product.nombre || ""} ${product.descripcion || ""} ${product.categoria || ""}`.toLowerCase();
      return queryWords.some((word) => searchText.includes(word));
    })
    .slice(0, 5);

  if (matches.length === 0) {
    return "";
  }

  return matches
    .map((product: any) => {
      let display = `- ${product.nombre}`;
      if (product.precio && product.precio > 0) display += `: $${product.precio}`;
      if (product.categoria) display += ` (${product.categoria})`;
      return display;
    })
    .join("\n");
}

/**
 * Herramienta para búsqueda semántica en la base de conocimientos del cliente.
 * Implementa la lógica de búsqueda jerárquica: Catálogo -> Fragmentos.
 */
export const knowledgeRetrieverTool = new DynamicStructuredTool({
  name: "knowledge_retriever",
  description: "Fuente principal de verdad del negocio. Úsala SIEMPRE PRIMERO cuando el usuario pregunte por servicios, productos, precios, planes, manuales, políticas o cualquier detalle específico. Contiene documentos cargados por el administrador con toda la información comercial y operativa.",
  schema: z.object({
    query: z.string().describe("La pregunta o término de búsqueda."),
    clientId: z.string().describe("ID del cliente para filtrar la búsqueda."),
    allowedDocIds: z.array(z.string()).optional().describe("Lista de IDs de documentos permitidos para este agente."),
  }),
  func: async ({ query, clientId, allowedDocIds = [] }) => {
    // Si no hay documentos autorizados, no gastar llamadas a Pinecone
    if (!allowedDocIds || allowedDocIds.length === 0) {
      console.log("📄 [KNOWLEDGE] Sin documentos autorizados para este agente, omitiendo búsqueda.");
      return `El agente no tiene documentos de conocimiento asignados.`;
    }
    console.log(`[DEBUG] allowedDocIds:`, allowedDocIds);

    try {
      const index = pinecone.index("chatbot-knowledge");
      // Asegurarse de que el namespace use el clientId real, no el nombre de la organización
      const namespace = `client_${clientId}`;

      console.log(`\n🔍 [KNOWLEDGE] ========== INICIO BÚSQUEDA =========`);
      console.log(`🔍 [KNOWLEDGE] Query: "${query}"`);
      console.log(`🔍 [KNOWLEDGE] ClienteId: ${clientId} | Namespace: ${namespace}`);
      console.log(`🔍 [KNOWLEDGE] Docs permitidos (${allowedDocIds.length}): ${allowedDocIds.join(", ")}`);
      
      // 1. Generar embedding de la consulta
      const queryVector = await embeddings.embedQuery(query);

      // 2. Capa 1: Traer todos los documentos permitidos y filtrar en memoria por docType
      const catalogResultsRaw = await index.namespace("document_catalog").query({
        vector: queryVector,
        topK: 20,
        filter: {
          clientId: { "$eq": clientId },
          docId: { "$in": allowedDocIds }
        },
        includeMetadata: true,
      });
      console.log(`[DEBUG] catalogResultsRaw.matches (${(catalogResultsRaw.matches || []).length}):`);
      for (const m of (catalogResultsRaw.matches || [])) {
        console.log(` - docId: ${m.metadata?.docId}, filename: ${m.metadata?.filename}, docType: ${m.metadata?.docType}, score: ${m.score}`);
      }
      // Filtrar en memoria: solo docType 'reference' o sin docType
      const catalogResults = {
        ...catalogResultsRaw,
        matches: (catalogResultsRaw.matches || []).filter(m => !m.metadata?.docType || m.metadata?.docType === "reference")
      };

      console.log(`🔍 [KNOWLEDGE] Capa 1 - Catálogo: ${catalogResults.matches.length} resultados (solo docType reference o vacío)`);
      for (const m of catalogResults.matches) {
        console.log(`   📑 ${m.metadata?.filename} (${m.metadata?.docId}) → docType: ${m.metadata?.docType} | score: ${(m.score || 0).toFixed(3)}`);
      }

      pushDebugEvent({
        node: "knowledge_retriever",
        timestamp: new Date().toISOString(),
        type: "catalog_search",
        data: {
          query,
          namespace,
          allowedDocIds,
          results: catalogResults.matches.map(m => ({
            docId: m.metadata?.docId,
            filename: m.metadata?.filename,
            score: +(m.score || 0).toFixed(4),
            description: (m.metadata?.description as string || "").slice(0, 120),
          })),
        },
      });

      const relevantDocIds = catalogResults.matches
        .filter(m => (m.score || 0) > 0.3)
        .map(m => m.metadata?.docId as string)
        .filter(Boolean);
      console.log(`[DEBUG] relevantDocIds (score > 0.3):`, relevantDocIds);

      console.log(`🔍 [KNOWLEDGE] Docs relevantes (score > 0.3): ${relevantDocIds.length > 0 ? relevantDocIds.join(", ") : "NINGUNO → fallback"}`);


      if (relevantDocIds.length === 0) {
        // Fallback: búsqueda más amplia pero SIEMPRE limitada a los docs del agente
        const broaderFilter: Record<string, any> = {
          clientId: { "$eq": clientId }
        };
        if (allowedDocIds.length > 0) {
          broaderFilter.docId = { "$in": allowedDocIds };
        }

        console.log(`🔍 [KNOWLEDGE] Fallback: búsqueda amplia en ${namespace}`);
        const broaderSearchRaw = await index.namespace(namespace).query({
          vector: queryVector,
          topK: 20,
          filter: broaderFilter,
          includeMetadata: true,
        });
        console.log(`[DEBUG] broaderSearchRaw.matches (${(broaderSearchRaw.matches || []).length}):`);
        for (const m of (broaderSearchRaw.matches || [])) {
          console.log(` - docId: ${m.metadata?.docId}, filename: ${m.metadata?.filename}, docType: ${m.metadata?.docType}, score: ${m.score}`);
        }
        // Filtrar en memoria: solo docType 'reference' o sin docType
        const broaderMatches = (broaderSearchRaw.matches || []).filter(m => !m.metadata?.docType || m.metadata?.docType === "reference");

        console.log(`[DEBUG] broaderMatches (docType reference o vacío): ${broaderMatches.length}`);
        for (const m of broaderMatches) {
          console.log(`   📑 ${m.metadata?.filename} (${m.metadata?.docId}) → docType: ${m.metadata?.docType} | score: ${(m.score || 0).toFixed(3)}`);
        }

        if (!broaderMatches || broaderMatches.length === 0) {
          const productFallback = seemsProductQuery(query) ? await searchProductsFallback(query, clientId) : "";
          if (productFallback) {
            return `No encontré información clara en documentos, pero sí encontré esto en el catálogo estructurado:\n\n${productFallback}`;
          }
          return "No se encontró información relevante ni en los documentos autorizados ni en el catálogo estructurado.";
        }
        
        return broaderMatches
          .filter(m => (m.score || 0) >= 0.25)
          .map(m => `[DOC: ${m.metadata?.filename}] [SECCIÓN: ${m.metadata?.description}]:\n${m.metadata?.text}`)
          .join("\n\n---\n\n");
      }

      // 3. Capa 2: Búsqueda granular POR CADA documento relevante
      // Buscamos en cada doc por separado para garantizar representación de todos
      const TOP_PER_DOC = 8;
      const allFragments: Array<{ score: number; filename: string; description: string; section_title: string; text: string; docId: string }> = [];

      const docSearches = relevantDocIds.map(async (docId) => {
        const resultRaw = await index.namespace(namespace).query({
          vector: queryVector,
          topK: TOP_PER_DOC,
          filter: { docId: { "$eq": docId } },
          includeMetadata: true,
        });
        console.log(`[DEBUG] Fragmentos para docId ${docId} (${(resultRaw.matches || []).length}):`);
        for (const m of (resultRaw.matches || [])) {
          console.log(` - filename: ${m.metadata?.filename}, docType: ${m.metadata?.docType}, score: ${m.score}, desc: ${(m.metadata?.description || '').slice(0, 60)}`);
        }
        // Filtrar en memoria: solo docType 'reference' o sin docType
        const filtered = (resultRaw.matches || [])
          .filter(m => !m.metadata?.docType || m.metadata?.docType === "reference")
          .filter(m => (m.score || 0) >= 0.20)
          .map(m => ({
            score: m.score || 0,
            filename: m.metadata?.filename as string || "",
            description: m.metadata?.description as string || "",
            section_title: m.metadata?.section_title as string || "",
            text: m.metadata?.text as string || "",
            docId,
          }));
        console.log(`[DEBUG] Fragmentos seleccionados para docId ${docId}: ${filtered.length}`);
        return filtered;
      });

      const docResults = await Promise.all(docSearches);
      for (let d = 0; d < relevantDocIds.length; d++) {
        const docId = relevantDocIds[d];
        const fragments = docResults[d];
        console.log(`🔍 [KNOWLEDGE] Capa 2 - Doc ${docId}: ${fragments.length} fragmentos`);
        for (const f of fragments) {
          console.log(`   📄 ${f.filename} → score: ${f.score.toFixed(3)} | ${f.description.slice(0, 80)}`);
        }
        allFragments.push(...fragments);
      }

      if (allFragments.length === 0) {
        const productFallback = seemsProductQuery(query) ? await searchProductsFallback(query, clientId) : "";
        if (productFallback) {
          return `No encontré fragmentos documentales específicos, pero sí encontré esto en el catálogo estructurado:\n\n${productFallback}`;
        }
        return "No se encontraron fragmentos específicos que respondan a la consulta, ni coincidencias útiles en el catálogo estructurado.";
      }

      // Ordenar por relevancia y seleccionar dinámicamente por umbral adaptativo
      allFragments.sort((a, b) => b.score - a.score);

      // Umbral adaptativo: el score mínimo aceptable es el 60% del mejor score,
      // con un piso absoluto de 0.30 para no incluir ruido.
      const bestScore = allFragments[0]?.score || 0;
      const RELATIVE_THRESHOLD = 0.50;
      const ABSOLUTE_MIN_SCORE = 0.25;
      const dynamicThreshold = Math.max(bestScore * RELATIVE_THRESHOLD, ABSOLUTE_MIN_SCORE);

      // Seleccionar todos los que superen el umbral, con un tope de seguridad de 20
      const HARD_MAX = 25;
      const topFragments = allFragments
        .filter(f => f.score >= dynamicThreshold)
        .slice(0, HARD_MAX);

      console.log(`🔍 [KNOWLEDGE] Selección dinámica: bestScore=${bestScore.toFixed(3)} | threshold=${dynamicThreshold.toFixed(3)} | ${allFragments.length} total → ${topFragments.length} seleccionados`);
      for (const f of topFragments) {
        console.log(`   ✅ score=${f.score.toFixed(3)} | ${f.filename} → ${f.description.slice(0, 60)}`);
      }

      pushDebugEvent({
        node: "knowledge_retriever",
        timestamp: new Date().toISOString(),
        type: "fragment_selection",
        data: {
          totalFragments: allFragments.length,
          bestScore: +bestScore.toFixed(4),
          dynamicThreshold: +dynamicThreshold.toFixed(4),
          selected: topFragments.map(f => ({
            docId: f.docId,
            filename: f.filename,
            section: f.section_title || f.description,
            score: +f.score.toFixed(4),
            textPreview: f.text.slice(0, 200),
          })),
          discarded: allFragments.filter(f => f.score < dynamicThreshold).length,
        },
      });

      return topFragments
        .map(f => {
          const section = f.section_title || f.description;
          return `[DOC: ${f.filename}] [SECCIÓN: ${section}]:\n${f.text}`;
        })
        .join("\n\n---\n\n");

    } catch (error) {
      console.error("Error en knowledge_retriever:", error);
      return "Hubo un error al consultar la base de conocimientos.";
    }
  },
});
