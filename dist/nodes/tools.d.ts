import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AgentStateType } from "../state/state.js";
/**
 * Nodo de Herramientas: Ejecuta automáticamente las llamadas a herramientas
 * generadas por el modelo y devuelve los resultados al estado del grafo.
 */
export declare const toolNode: ToolNode<any>;
export declare function toolNodeWithLogs(state: AgentStateType): Promise<any>;
