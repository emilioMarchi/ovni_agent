import { getRecentMessages } from "../utils/historyUtils.js";
import { getOlderMessages, semanticSearchHistory } from "../utils/contextLayersUtils.js";
/**
 * Nodo de recuperación de historial para el grafo.
 * Recupera los últimos N mensajes relevantes y los agrega al contexto.
 */
export async function historyRetrieverNode(state) {
    const { threadId, agentId, userInfo, contextQuery, fastPath } = state;
    if (!threadId || !agentId)
        return {};
    const inMemoryConversation = state.messages.filter((message) => {
        const role = typeof message?._getType === "function" ? message._getType() : "";
        return role === "human" || role === "ai";
    });
    if (inMemoryConversation.length >= 6) {
        return {};
    }
    const recentLimit = fastPath ? 4 : 15;
    let contextHistory = await getRecentMessages(threadId, agentId, recentLimit);
    if (fastPath) {
        return { contextHistory };
    }
    // Si Gemini/modelo requiere más contexto (simulación: menos de 5 mensajes)
    if (contextHistory.length < 5) {
        const older = await getOlderMessages(threadId, 15, 15);
        contextHistory = contextHistory.concat(older);
    }
    // Si aún no hay suficiente contexto y hay query, buscar por similitud
    if (contextHistory.length < 5 && userInfo?.email && contextQuery) {
        const semantic = await semanticSearchHistory(userInfo.email, contextQuery, 10);
        contextHistory = contextHistory.concat(semantic);
    }
    return { contextHistory };
}
//# sourceMappingURL=history_retriever.js.map