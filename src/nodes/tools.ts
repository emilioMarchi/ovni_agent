import { ToolNode } from "@langchain/langgraph/prebuilt";
import { tools } from "../tools/index.js";

/**
 * Nodo de Herramientas: Ejecuta automáticamente las llamadas a herramientas
 * generadas por el modelo y devuelve los resultados al estado del grafo.
 */
export const toolNode = new ToolNode(tools);
