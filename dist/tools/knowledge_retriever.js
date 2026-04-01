import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import admin from "firebase-admin";
const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
});
const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "gemini-embedding-001",
    taskType: TaskType.RETRIEVAL_QUERY,
    apiKey: process.env.GEMINI_API_KEY,
});
function seemsProductQuery(query) {
    return /(producto|productos|cat[aá]logo|precio|precios|plan|planes|destacado|destacados|sku|disponible|stock|presupuesto)/i.test(query);
}
async function searchProductsFallback(query, clientId) {
    const db = admin.firestore();
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter((word) => word.length > 2);
    const snapshot = await db.collection("products")
        .where("clientId", "==", clientId)
        .limit(20)
        .get();
    const matches = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((product) => {
        const searchText = `${product.nombre || ""} ${product.descripcion || ""} ${product.categoria || ""}`.toLowerCase();
        return queryWords.some((word) => searchText.includes(word));
    })
        .slice(0, 5);
    if (matches.length === 0) {
        return "";
    }
    return matches
        .map((product) => {
        let display = `- ${product.nombre}`;
        if (product.precio && product.precio > 0)
            display += `: $${product.precio}`;
        if (product.categoria)
            display += ` (${product.categoria})`;
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
            return "Este agente no tiene documentos de conocimiento asignados.";
        }
        try {
            const index = pinecone.index("chatbot-knowledge");
            const namespace = `client_${clientId}`;
            console.log(`\n🔍 [KNOWLEDGE] ========== INICIO BÚSQUEDA =========`);
            console.log(`🔍 [KNOWLEDGE] Query: "${query}"`);
            console.log(`🔍 [KNOWLEDGE] Cliente: ${clientId} | Namespace: ${namespace}`);
            console.log(`🔍 [KNOWLEDGE] Docs permitidos (${allowedDocIds.length}): ${allowedDocIds.join(", ")}`);
            // 1. Generar embedding de la consulta
            const queryVector = await embeddings.embedQuery(query);
            // 2. Capa 1: Filtrar documentos relevantes en el catálogo
            // Nota: En la v2, mantenemos la lógica de 'document_catalog' para pre-filtrado si es necesario
            const catalogResults = await index.namespace("document_catalog").query({
                vector: queryVector,
                topK: 8,
                filter: {
                    clientId: { "$eq": clientId },
                    docId: { "$in": allowedDocIds }
                },
                includeMetadata: true,
            });
            console.log(`🔍 [KNOWLEDGE] Capa 1 - Catálogo: ${catalogResults.matches.length} resultados`);
            for (const m of catalogResults.matches) {
                console.log(`   📑 ${m.metadata?.filename} (${m.metadata?.docId}) → score: ${(m.score || 0).toFixed(3)}`);
            }
            const relevantDocIds = catalogResults.matches
                .filter(m => (m.score || 0) > 0.3)
                .map(m => m.metadata?.docId)
                .filter(Boolean);
            console.log(`🔍 [KNOWLEDGE] Docs relevantes (score > 0.3): ${relevantDocIds.length > 0 ? relevantDocIds.join(", ") : "NINGUNO → fallback"}`);
            if (relevantDocIds.length === 0) {
                // Fallback: búsqueda más amplia pero SIEMPRE limitada a los docs del agente
                const broaderFilter = { clientId: { "$eq": clientId } };
                if (allowedDocIds.length > 0) {
                    broaderFilter.docId = { "$in": allowedDocIds };
                }
                console.log(`🔍 [KNOWLEDGE] Fallback: búsqueda amplia en ${namespace}`);
                const broaderSearch = await index.namespace(namespace).query({
                    vector: queryVector,
                    topK: 10,
                    filter: broaderFilter,
                    includeMetadata: true,
                });
                console.log(`🔍 [KNOWLEDGE] Fallback: ${broaderSearch.matches?.length || 0} resultados`);
                for (const m of (broaderSearch.matches || [])) {
                    console.log(`   📄 ${m.metadata?.filename} → score: ${(m.score || 0).toFixed(3)} | ${(m.metadata?.description || "").slice(0, 80)}`);
                }
                if (!broaderSearch.matches || broaderSearch.matches.length === 0) {
                    const productFallback = seemsProductQuery(query) ? await searchProductsFallback(query, clientId) : "";
                    if (productFallback) {
                        return `No encontré información clara en documentos, pero sí encontré esto en el catálogo estructurado:\n\n${productFallback}`;
                    }
                    return "No se encontró información relevante ni en los documentos autorizados ni en el catálogo estructurado.";
                }
                return broaderSearch.matches
                    .filter(m => (m.score || 0) >= 0.25)
                    .map(m => `[DOC: ${m.metadata?.filename}] [SECCIÓN: ${m.metadata?.description}]:\n${m.metadata?.text}`)
                    .join("\n\n---\n\n");
            }
            // 3. Capa 2: Búsqueda granular POR CADA documento relevante
            // Buscamos en cada doc por separado para garantizar representación de todos
            const TOP_PER_DOC = 8;
            const allFragments = [];
            const docSearches = relevantDocIds.map(async (docId) => {
                const result = await index.namespace(namespace).query({
                    vector: queryVector,
                    topK: TOP_PER_DOC,
                    filter: { docId: { "$eq": docId } },
                    includeMetadata: true,
                });
                return (result.matches || [])
                    .filter(m => (m.score || 0) >= 0.20)
                    .map(m => ({
                    score: m.score || 0,
                    filename: m.metadata?.filename || "",
                    description: m.metadata?.description || "",
                    text: m.metadata?.text || "",
                    docId,
                }));
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
            return topFragments
                .map(f => `[DOC: ${f.filename}] [SECCIÓN: ${f.description}]:\n${f.text}`)
                .join("\n\n---\n\n");
        }
        catch (error) {
            console.error("Error en knowledge_retriever:", error);
            return "Hubo un error al consultar la base de conocimientos.";
        }
    },
});
//# sourceMappingURL=knowledge_retriever.js.map