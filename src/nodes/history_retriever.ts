import { AgentStateType } from "../state/state.js";
import { getRecentMessages } from "../utils/historyUtils.js";
import { getOlderMessages, semanticSearchHistory } from "../utils/contextLayersUtils.js";

/**
 * Nodo de recuperación de historial para el grafo.
 * Recupera los últimos N mensajes relevantes y los agrega al contexto.
 */
export async function historyRetrieverNode(state: AgentStateType) {
  const { threadId, agentId, userInfo, contextQuery } = state;
  if (!threadId || !agentId) return {};
  let contextHistory = await getRecentMessages(threadId, agentId, 15);

  // Si Gemini/modelo requiere más contexto (simulación: menos de 5 mensajes)
  if (contextHistory.length < 5) {
    const older = await getOlderMessages(threadId, agentId, 15);
    contextHistory = contextHistory.concat(older);
  }

  // Si aún no hay suficiente contexto y hay query, buscar por similitud
  if (contextHistory.length < 5 && userInfo?.email && contextQuery) {
    const semantic = await semanticSearchHistory(userInfo.email, contextQuery, 10);
    contextHistory = contextHistory.concat(semantic);
  }

  return { contextHistory };
}
