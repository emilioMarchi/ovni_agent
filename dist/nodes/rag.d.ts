import "dotenv/config";
import { AgentStateType } from "../state/state.js";
/**
 * Nodo de Recuperación de Conocimiento (RAG Pre-fetch).
 * Se ejecuta ANTES del modelo para buscar contexto relevante en Pinecone
 * y agregarlo al estado. Así el modelo SIEMPRE tiene contexto del RAG.
 */
export declare function ragNode(state: AgentStateType): Promise<{
    ragContext?: undefined;
} | {
    ragContext: string;
}>;
