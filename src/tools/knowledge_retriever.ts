import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "gemini-embedding-001",
  taskType: TaskType.RETRIEVAL_QUERY,
  apiKey: process.env.GEMINI_API_KEY,
});

/**
 * Herramienta para búsqueda semántica en la base de conocimientos del cliente.
 * Implementa la lógica de búsqueda jerárquica: Catálogo -> Fragmentos.
 */
export const knowledgeRetrieverTool = new DynamicStructuredTool({
  name: "knowledge_retriever",
  description: "Úsala SIEMPRE que el usuario pregunte por detalles específicos, servicios, manuales, políticas, precios de servicios o preguntas frecuentes. Esta es la única fuente de verdad para información detallada del negocio.",
  schema: z.object({
    query: z.string().describe("La pregunta o término de búsqueda."),
    clientId: z.string().describe("ID del cliente para filtrar la búsqueda."),
    allowedDocIds: z.array(z.string()).optional().describe("Lista de IDs de documentos permitidos para este agente."),
  }),
  func: async ({ query, clientId, allowedDocIds = [] }) => {
    try {
      const index = pinecone.index("chatbot-knowledge"); // Nombre del índice real corregido
      const namespace = `client_${clientId}`;
      
      // 1. Generar embedding de la consulta
      const queryVector = await embeddings.embedQuery(query);

      // 2. Capa 1: Filtrar documentos relevantes en el catálogo
      // Nota: En la v2, mantenemos la lógica de 'document_catalog' para pre-filtrado si es necesario
      const catalogResults = await index.namespace("document_catalog").query({
        vector: queryVector,
        topK: 5,
        filter: { 
          clientId: { "$eq": clientId },
          docId: { "$in": allowedDocIds }
        },
        includeMetadata: true,
      });

      const relevantDocIds = catalogResults.matches
        .filter(m => (m.score || 0) > 0.3)
        .map(m => m.metadata?.docId as string)
        .filter(Boolean);

      if (relevantDocIds.length === 0) {
        const broaderSearch = await index.namespace(namespace).query({
          vector: queryVector,
          topK: 5,
          includeMetadata: true,
        });
        
        if (!broaderSearch.matches || broaderSearch.matches.length === 0) {
          return "No se encontró información relevante en los documentos autorizados.";
        }
        
        return broaderSearch.matches
          .filter(m => (m.score || 0) >= 0.25)
          .map(m => `[DOC: ${m.metadata?.filename}] [SECCIÓN: ${m.metadata?.description}]:\n${m.metadata?.text}`)
          .join("\n\n---\n\n");
      }

      // 3. Capa 2: Búsqueda granular en el namespace del cliente
      const searchResult = await index.namespace(namespace).query({
        vector: queryVector,
        topK: 5,
        filter: { docId: { "$in": relevantDocIds } },
        includeMetadata: true,
      });

      if (!searchResult.matches || searchResult.matches.length === 0) {
        return "No se encontraron fragmentos específicos que respondan a la consulta.";
      }

      return searchResult.matches
        .filter(m => (m.score || 0) >= 0.25)
        .map(m => `[DOC: ${m.metadata?.filename}] [SECCIÓN: ${m.metadata?.description}]:\n${m.metadata?.text}`)
        .join("\n\n---\n\n");

    } catch (error) {
      console.error("Error en knowledge_retriever:", error);
      return "Hubo un error al consultar la base de conocimientos.";
    }
  },
});
