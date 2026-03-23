import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { toolsCondition } from "@langchain/langgraph/prebuilt";
import { AgentState } from "../state/state.js";
import { configNode } from "../nodes/config.js";
import { modelNode } from "../nodes/model.js";
import { toolNode } from "../nodes/tools.js";
import { saveHistoryNode } from "../nodes/save_history.js";

/**
 * Orquestador del Agente OVNI v2.
 */
const workflow = new StateGraph(AgentState)
  // 1. Agregar los nodos
  .addNode("config", configNode)
  .addNode("agent", modelNode)
  .addNode("tools", toolNode)
  .addNode("save_history", saveHistoryNode)

  // 2. Definir flujo
  .addEdge(START, "config")
  .addEdge("config", "agent")

  // 3. Bordes condicionales: Si el modelo genera 'tool_calls', ir al nodo 'tools'.
  // Si no, ir al nodo de persistencia de historial.
  .addConditionalEdges(
    "agent",
    toolsCondition,
    {
      tools: "tools",
      __end__: "save_history",
    }
  )

  // 4. Tras ejecutar las herramientas, volver al agente para procesar resultados.
  .addEdge("tools", "agent")

  // 5. El nodo de persistencia termina el flujo
  .addEdge("save_history", END);

/**
 * Inicializar la persistencia en memoria (Thread-level).
 * Esto permite retomar la conversación usando un 'thread_id'.
 */
const checkpointer = new MemorySaver();

/**
 * Compilar el grafo para su ejecución.
 */
export const graph = workflow.compile({
  checkpointer,
});

/**
 * Exportar el grafo para su uso en la aplicación principal o tests.
 */
export default graph;
