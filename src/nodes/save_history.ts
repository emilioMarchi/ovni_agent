import admin from "firebase-admin";
import { AgentStateType } from "../state/state.js";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";

/**
 * Nodo de Persistencia (Nivel 2): Guarda el historial de la sesión en Firestore.
 * Esto asegura que la charla sea recuperable incluso si el checkpointer volátil falla.
 */
export async function saveHistoryNode(state: AgentStateType) {
  const { messages, clientId, agentId, userInfo } = state;

  if (!messages || messages.length === 0) return {};

  try {
    const db = admin.firestore();
    const userId = userInfo?.phone || "anonymous";
    const docId = `conv_${agentId}_${userId}`;

    // 1. Transformar mensajes a formato serializable para Firestore
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

    // 2. Guardar en la colección de historial (Nivel 2)
    await db.collection("history").doc(docId).set({
      clientId,
      agentId,
      userId,
      messages: serializableMessages,
      lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // console.log(`💾 Historial persistido para: ${docId}`);

  } catch (error) {
    console.error("❌ Error en saveHistoryNode:", error);
  }

  return {};
}
