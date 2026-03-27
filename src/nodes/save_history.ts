import admin from "firebase-admin";
import { AgentStateType } from "../state/state.js";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { analyzeSession } from "../services/sessionAnalyzer.js";

/**
 * Nodo de Persistencia (Nivel 2): Guarda el historial de la sesión en Firestore.
 * Esto asegura que la charla sea recuperable incluso si el checkpointer volátil falla.
 */
export async function saveHistoryNode(state: AgentStateType) {
  const { messages, clientId, agentId, userInfo } = state;

  if (!messages || messages.length === 0) return {};

  try {
    const db = admin.firestore();
    const userId = userInfo?.phone || userInfo?.email || "anonymous";
    const docId = `conv_${agentId}_${userId}`;

    const serializableMessages = messages.map(msg => {
      let role = "unknown";
      if (msg instanceof HumanMessage) role = "user";
      else if (msg instanceof AIMessage) role = "assistant";
      else if (msg instanceof ToolMessage) role = "tool";

      return {
        role,
        content: msg.content,
        timestamp: new Date().toISOString(),
        metadata: (msg as any).tool_calls || {},
      };
    });

    const analysis = await analyzeSession(serializableMessages);

    await db.collection("history").doc(docId).set({
      clientId: clientId || "unknown",
      agentId: agentId || "unknown",
      userId,
      threadId: state.threadId,
      messages: serializableMessages,
      summary: analysis.summary,
      classification: analysis.classification,
      lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

  } catch (error) {
    console.error("❌ Error en saveHistoryNode:", error);
  }

  return {};
}
