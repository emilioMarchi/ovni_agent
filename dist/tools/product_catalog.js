import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import admin from "firebase-admin";
function normalizeSearchText(value) {
    return typeof value === "string" ? value.trim() : "";
}
async function searchDocumentsFallback(query, clientId, allowedDocIds = []) {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) {
        return "";
    }
    const index = pinecone.index("chatbot-knowledge");
    const namespace = `client_${clientId}`;
    const queryVector = await embeddings.embedQuery(normalizedQuery);
    const queryOptions = {
        vector: queryVector,
        topK: 4,
        includeMetadata: true,
    };
    if (allowedDocIds.length > 0) {
        queryOptions.filter = { docId: { "$in": allowedDocIds } };
    }
    const searchResult = await index.namespace(namespace).query(queryOptions);
    const matches = (searchResult.matches || []).filter((match) => (match.score || 0) >= 0.25);
    if (matches.length === 0) {
        return "";
    }
    return matches
        .map((match) => `[DOC: ${match.metadata?.filename}] [SECCIÓN: ${match.metadata?.description}]:\n${match.metadata?.text}`)
        .join("\n\n---\n\n");
}
const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
});
const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "gemini-embedding-001",
    taskType: TaskType.RETRIEVAL_QUERY,
    apiKey: process.env.GEMINI_API_KEY,
});
/**
 * Herramienta para búsqueda inteligente de productos.
 * Combina búsqueda semántica (Pinecone) con búsqueda de texto directo y filtrado por categoría.
 */
export const productCatalogTool = new DynamicStructuredTool({
    name: "product_catalog",
    description: "Busca productos en el catálogo estructurado (base de datos). Úsala SOLO como complemento DESPUÉS de haber buscado en knowledge_retriever. Si knowledge_retriever ya devolvió info de productos o servicios, NO uses esta herramienta.",
    schema: z.object({
        query: z.preprocess(normalizeSearchText, z.string().default("")).describe("Nombre o descripción del producto buscado."),
        clientId: z.preprocess(normalizeSearchText, z.string()).describe("ID del cliente para filtrar por su catálogo."),
        allowedCategories: z.array(z.string()).optional().default([]).describe("Categorías permitidas para restringir la búsqueda."),
        allowedDocIds: z.array(z.string()).optional().default([]).describe("IDs de documentos autorizados para fallback documental."),
        listAll: z.coerce.boolean().optional().default(false).describe("Indica si debe listar todos los productos destacados sin filtrar por búsqueda semántica."),
    }),
    func: async ({ query, clientId, allowedCategories = [], allowedDocIds = [], listAll = false }) => {
        try {
            const db = admin.firestore();
            let results = [];
            const normalizedQuery = normalizeSearchText(query);
            if (listAll || !normalizedQuery) {
                const snapshot = await db.collection("products")
                    .where("clientId", "==", clientId)
                    .limit(10)
                    .get();
                results = snapshot.docs.map(doc => ({ id: doc.id, score: 1, ...doc.data() }));
            }
            else {
                const queryLower = normalizedQuery.toLowerCase();
                const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
                let snapshot = await db.collection("products")
                    .where("clientId", "==", clientId)
                    .limit(20)
                    .get();
                results = snapshot.docs
                    .map(doc => ({ id: doc.id, score: 0.5, ...doc.data() }))
                    .filter((p) => {
                    const searchText = `${p.nombre} ${p.descripcion || ''} ${p.categoria || ''}`.toLowerCase();
                    return queryWords.some(word => searchText.includes(word));
                })
                    .map((p) => ({
                    ...p,
                    score: p.nombre?.toLowerCase().includes(queryWords[0]) ? 0.9 : 0.5
                }));
            }
            // 3. Filtrado por categorías permitidas
            if (allowedCategories.length > 0) {
                results = results.filter(p => allowedCategories.includes(p.categoria));
            }
            // 4. Formatear salida
            if (results.length === 0) {
                const fallback = await searchDocumentsFallback(normalizedQuery, clientId, allowedDocIds);
                if (fallback) {
                    return `No encontré coincidencias claras en el catálogo estructurado. Pero sí encontré esta información en documentos del negocio:\n\n${fallback}`;
                }
                return "No se encontraron productos que coincidan con tu búsqueda ni información relacionada en los documentos del negocio.";
            }
            return results
                .sort((a, b) => (b.score || 0) - (a.score || 0))
                .slice(0, 5)
                .map(p => {
                let display = `- ${p.nombre}`;
                if (p.precio && p.precio > 0)
                    display += `: $${p.precio}`;
                if (p.categoria)
                    display += ` (${p.categoria})`;
                if (p.sku)
                    display += ` [Ref: ${p.sku}]`;
                return display;
            })
                .join("\n");
        }
        catch (error) {
            console.error("Error en product_catalog:", error);
            return "Hubo un error al consultar el catálogo de productos.";
        }
    },
});
//# sourceMappingURL=product_catalog.js.map