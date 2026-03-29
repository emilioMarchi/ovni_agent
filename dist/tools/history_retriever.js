import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
});
const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "gemini-embedding-001",
    taskType: TaskType.RETRIEVAL_QUERY,
    apiKey: process.env.GEMINI_API_KEY,
});
/**
 * Herramienta de Memoria a Largo Plazo (Nivel 3).
 * Busca en el historial semántico de Pinecone para recordar temas de charlas pasadas.
 */
export const historyRetrieverTool = new DynamicStructuredTool({
    name: "history_retriever",
    description: "Busca en el historial de conversaciones pasadas con este usuario. Úsala cuando el usuario mencione algo que 'ya dijo antes' o 'hace tiempo' y no esté en la charla actual.",
    schema: z.object({
        query: z.string().describe("Lo que el usuario quiere recordar."),
        userId: z.string().describe("ID del usuario (teléfono o ID de sesión)."),
        agentId: z.string().describe("ID del agente actual."),
    }),
    func: async ({ query, userId, agentId }) => {
        try {
            const index = pinecone.index("chatbot-knowledge");
            const namespace = `history_${agentId}_${userId}`;
            const queryVector = await embeddings.embedQuery(query);
            const searchResult = await index.namespace(namespace).query({
                vector: queryVector,
                topK: 3,
                includeMetadata: true,
            });
            if (!searchResult.matches || searchResult.matches.length === 0) {
                return "No encontré recuerdos previos sobre ese tema.";
            }
            return searchResult.matches
                .map(m => `[Fecha: ${m.metadata?.timestamp}] ${m.metadata?.role}: ${m.metadata?.text}`)
                .join("\n---\n");
        }
        catch (error) {
            console.error("Error en history_retriever:", error);
            return "Error al intentar acceder a la memoria de largo plazo.";
        }
    },
});
//# sourceMappingURL=history_retriever.js.map