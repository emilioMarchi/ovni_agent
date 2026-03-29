import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { toolsCondition } from "@langchain/langgraph/prebuilt";
import { AgentState } from "../state/state.js";
import { configNode } from "../nodes/config.js";
import { modelNode } from "../nodes/model.js";
import { toolNodeWithLogs } from "../nodes/tools.js";
import { saveHistoryNode } from "../nodes/save_history.js";
import { historyRetrieverNode } from "../nodes/history_retriever.js";
import { speechToTextNode } from "../nodes/speechToText.js";
import { textToSpeechNode } from "../nodes/textToSpeech.js";
/**
 * Orquestador del Agente OVNI v2.
 */
const workflow = new StateGraph(AgentState)
    .addNode("config", configNode)
    .addNode("history_retriever", historyRetrieverNode)
    .addNode("speech_to_text", speechToTextNode)
    .addNode("agent", modelNode)
    .addNode("tools", toolNodeWithLogs)
    .addNode("text_to_speech", textToSpeechNode)
    .addNode("save_history", saveHistoryNode)
    .addEdge(START, "config")
    .addEdge("config", "history_retriever")
    .addEdge("history_retriever", "speech_to_text")
    .addEdge("speech_to_text", "agent")
    // Si el modelo genera tool_calls, ir a tools. Si no, ir a TTS.
    .addConditionalEdges("agent", toolsCondition, {
    tools: "tools",
    __end__: "text_to_speech",
})
    // Tras ejecutar herramientas, volver al agente.
    .addEdge("tools", "agent")
    // TTS -> guardar historial -> fin
    .addEdge("text_to_speech", "save_history")
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
//# sourceMappingURL=index.js.map