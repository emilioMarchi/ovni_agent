import "dotenv/config";
import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { HumanMessage } from "@langchain/core/messages";
const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
});
const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "gemini-embedding-001",
    taskType: TaskType.RETRIEVAL_QUERY,
    apiKey: process.env.GEMINI_API_KEY,
});
/**
 * Nodo de Recuperación de Conocimiento (RAG Pre-fetch).
 * Se ejecuta ANTES del modelo para buscar contexto relevante en Pinecone
 * y agregarlo al estado. Así el modelo SIEMPRE tiene contexto del RAG.
 */
export async function ragNode(state) {
    const { messages, clientId, allowedDocIds } = state;
    if (!messages || messages.length === 0)
        return {};
    if (!clientId)
        return {};
    const lastMessage = messages[messages.length - 1];
    if (!(lastMessage instanceof HumanMessage))
        return {};
    const query = lastMessage.content;
    if (typeof query !== "string" || query.length < 3)
        return {};
    try {
        const index = pinecone.index("chatbot-knowledge");
        const namespace = `client_${clientId}`;
        const queryVector = await embeddings.embedQuery(query);
        let ragContext = "";
        if (allowedDocIds && allowedDocIds.length > 0) {
            const results = await index.namespace(namespace).query({
                vector: queryVector,
                topK: 3,
                filter: { docId: { "$in": allowedDocIds } },
                includeMetadata: true,
            });
            if (results.matches && results.matches.length > 0) {
                ragContext = results.matches
                    .filter(m => (m.score || 0) > 0.2)
                    .map(m => `[INFO]: ${m.metadata?.text}`)
                    .join("\n\n");
            }
        }
        if (!ragContext) {
            const broadResults = await index.namespace(namespace).query({
                vector: queryVector,
                topK: 3,
                includeMetadata: true,
            });
            if (broadResults.matches && broadResults.matches.length > 0) {
                ragContext = broadResults.matches
                    .filter(m => (m.score || 0) > 0.2)
                    .map(m => `[INFO]: ${m.metadata?.text}`)
                    .join("\n\n");
            }
        }
        if (ragContext) {
            console.log(`📚 RAG pre-fetch: Contexto encontrado (${ragContext.length} chars)`);
            return { ragContext };
        }
    }
    catch (error) {
        console.error("❌ Error en ragNode:", error);
    }
    return {};
}
//# sourceMappingURL=rag.js.map