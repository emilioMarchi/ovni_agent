import { ToolNode } from "@langchain/langgraph/prebuilt";
import { tools } from "../tools/index.js";
import { AgentStateType } from "../state/state.js";

/**
 * Nodo de Herramientas: Ejecuta automáticamente las llamadas a herramientas
 * generadas por el modelo y devuelve los resultados al estado del grafo.
 */
export const toolNode = new ToolNode(tools);

export async function toolNodeWithLogs(state: AgentStateType) {
  const lastMessage = state.messages[state.messages.length - 1];
  
  if (lastMessage && lastMessage.additional_kwargs?.tool_calls) {
    const toolCalls = lastMessage.additional_kwargs.tool_calls;
    console.log("🔧 [TOOLS] Llamadas a ejecutar:", toolCalls.map((tc: any) => tc.function?.name));
    
    for (const tc of toolCalls) {
      console.log("🔧 [TOOLS] Ejecutando:", tc.function?.name);
      console.log("🔧 [TOOLS] Args:", tc.function?.arguments);
    }
  }
  
  const result = await toolNode.invoke(state);
  
  const lastResult = result.messages[result.messages.length - 1];
  if (lastResult) {
    console.log("🔧 [TOOLS] Resultado:", (lastResult.content as string)?.substring(0, 300));
  }
  
  return result;
}
