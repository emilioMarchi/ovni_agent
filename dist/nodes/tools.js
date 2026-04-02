import { ToolNode } from "@langchain/langgraph/prebuilt";
import { tools } from "../tools/index.js";
import { AIMessage } from "@langchain/core/messages";
/**
 * Nodo de Herramientas: Ejecuta automáticamente las llamadas a herramientas
 * generadas por el modelo y devuelve los resultados al estado del grafo.
 */
export const toolNode = new ToolNode(tools);
/**
 * Inyecta allowedDocIds y clientId del estado en las tool_calls de knowledge_retriever
 * para que el filtrado de documentos por agente sea obligatorio y no dependa del LLM.
 */
function injectAllowedDocIds(message, state) {
    const { allowedDocIds = [], clientId } = state;
    // Parchar tool_calls del mensaje (formato LangChain)
    if (message.tool_calls && Array.isArray(message.tool_calls)) {
        const patchedToolCalls = message.tool_calls.map((tc) => {
            if (tc.name === "knowledge_retriever") {
                return {
                    ...tc,
                    args: {
                        ...tc.args,
                        clientId: tc.args?.clientId || clientId,
                        allowedDocIds,
                    },
                };
            }
            if (tc.name === "document_analyzer") {
                return {
                    ...tc,
                    args: {
                        ...tc.args,
                        clientId: tc.args?.clientId || clientId,
                        allowedDocIds,
                    },
                };
            }
            return tc;
        });
        // Crear un nuevo AIMessage con las tool_calls parcheadas
        const patched = new AIMessage({
            content: message.content,
            tool_calls: patchedToolCalls,
            additional_kwargs: message.additional_kwargs,
            response_metadata: message.response_metadata,
            id: message.id,
        });
        return patched;
    }
    return message;
}
export async function toolNodeWithLogs(state) {
    const lastMessage = state.messages[state.messages.length - 1];
    if (lastMessage && lastMessage.additional_kwargs?.tool_calls) {
        const toolCalls = lastMessage.additional_kwargs.tool_calls;
        console.log("🔧 [TOOLS] Llamadas a ejecutar:", toolCalls.map((tc) => tc.function?.name));
        for (const tc of toolCalls) {
            console.log("🔧 [TOOLS] Ejecutando:", tc.function?.name);
            console.log("🔧 [TOOLS] Args:", tc.function?.arguments);
        }
    }
    // Inyectar allowedDocIds en knowledge_retriever antes de ejecutar
    const patchedMessage = injectAllowedDocIds(lastMessage, state);
    // Filtrar tool_calls alucinadas: si el modelo llama a una tool que no está habilitada,
    // la eliminamos antes de pasar al ToolNode para evitar ejecuciones no autorizadas.
    if (patchedMessage.tool_calls && Array.isArray(patchedMessage.tool_calls)) {
        const { functions = [], skills = [], allowedDocIds = [] } = state;
        const blockedTools = new Set();
        // knowledge_retriever sin docs → bloquear
        if (allowedDocIds.length === 0)
            blockedTools.add("knowledge_retriever");
        const filtered = patchedMessage.tool_calls.filter((tc) => {
            if (blockedTools.has(tc.name)) {
                console.log(`🚫 [TOOLS] Bloqueando tool_call alucinada: ${tc.name} (no habilitada para este agente)`);
                return false;
            }
            return true;
        });
        if (filtered.length === 0 && patchedMessage.tool_calls.length > 0) {
            // Todas las tool calls fueron bloqueadas → devolver mensaje de error al agente
            const { ToolMessage } = await import("@langchain/core/messages");
            const blockedResponses = patchedMessage.tool_calls.map((tc) => new ToolMessage({
                content: "Esta herramienta no está disponible para este agente.",
                tool_call_id: tc.id,
                name: tc.name,
            }));
            return { messages: blockedResponses };
        }
        if (filtered.length < patchedMessage.tool_calls.length) {
            // Algunas bloqueadas: reconstruir el mensaje con solo las válidas
            const { ToolMessage } = await import("@langchain/core/messages");
            const blockedCalls = patchedMessage.tool_calls.filter((tc) => blockedTools.has(tc.name));
            const blockedResponses = blockedCalls.map((tc) => new ToolMessage({
                content: "Esta herramienta no está disponible para este agente.",
                tool_call_id: tc.id,
                name: tc.name,
            }));
            const newMessage = new AIMessage({
                content: patchedMessage.content,
                tool_calls: filtered,
                additional_kwargs: patchedMessage.additional_kwargs,
                response_metadata: patchedMessage.response_metadata,
                id: patchedMessage.id,
            });
            const patchedStateLimited = {
                ...state,
                messages: [...state.messages.slice(0, -1), newMessage],
            };
            const result = await toolNode.invoke(patchedStateLimited);
            result.messages = [...blockedResponses, ...result.messages];
            return result;
        }
    }
    const patchedState = {
        ...state,
        messages: [...state.messages.slice(0, -1), patchedMessage],
    };
    const result = await toolNode.invoke(patchedState);
    const lastResult = result.messages[result.messages.length - 1];
    if (lastResult) {
        console.log("🔧 [TOOLS] Resultado:", lastResult.content?.substring(0, 300));
    }
    return result;
}
//# sourceMappingURL=tools.js.map