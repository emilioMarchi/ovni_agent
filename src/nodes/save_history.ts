import admin from "firebase-admin";
import { AgentStateType } from "../state/state.js";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { analyzeSession } from "../services/sessionAnalyzer.js";

const MAX_MESSAGE_LENGTH = 2000;

function cleanMessageContent(content: string, role: string): string {
  if (role === "tool") {
    return "[Información de contexto]";
  }
  const str = typeof content === 'string' ? content : JSON.stringify(content);
  const truncated = str.slice(0, MAX_MESSAGE_LENGTH);
  return str.length > MAX_MESSAGE_LENGTH ? truncated + "..." : truncated;
}

function formatSessionDate(date: Date): string {
  return date.toLocaleString('es-AR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export async function saveHistoryNode(state: AgentStateType) {
  const { messages, clientId, agentId, userInfo, threadId, endSession } = state;

  if (!messages || messages.length === 0) return {};

  try {
    const db = admin.firestore();
    const userId = userInfo?.phone || userInfo?.email || "anonymous";
    const userName = userInfo?.name || null;
    const docId = `conv_${agentId}_${userId}`;

    const serializableMessages = messages.map(msg => {
      let role = "unknown";
      if (msg instanceof HumanMessage) role = "user";
      else if (msg instanceof AIMessage) role = "assistant";
      else if (msg instanceof ToolMessage) role = "tool";

      return {
        role,
        content: cleanMessageContent(msg.content as string, role),
        timestamp: new Date().toISOString(),
        metadata: (msg as any).tool_calls || {},
      };
    });

    let summary: string | undefined;
    let classification: any = undefined;

    if (endSession) {
      const userAndAssistantMessages = serializableMessages.filter(m => m.role === "user" || m.role === "assistant");
      const now = new Date();
      const sessionDate = formatSessionDate(now);
      const analysis = await analyzeSession(userAndAssistantMessages, userName);
      
      summary = `[${sessionDate}] ${analysis.summary}`;
      classification = analysis.classification;
    }

    await db.collection("history").doc(docId).set({
      clientId: clientId || "unknown",
      agentId: agentId || "unknown",
      userId,
      userName,
      threadId,
      messages: serializableMessages,
      summary: summary,
      classification: classification,
      lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

  } catch (error) {
    console.error("❌ Error en saveHistoryNode:", error);
  }

  return {};
}
