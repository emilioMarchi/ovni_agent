import { AgentStateType } from "../state/state.js";
/**
 * Nodo de recuperación de historial para el grafo.
 * Recupera los últimos N mensajes relevantes y los agrega al contexto.
 */
export declare function historyRetrieverNode(state: AgentStateType): Promise<{
    contextHistory?: undefined;
} | {
    contextHistory: any;
}>;
