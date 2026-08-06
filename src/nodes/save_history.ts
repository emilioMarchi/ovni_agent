import admin from "firebase-admin";
import { AgentStateType } from "../state/state.js";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { analyzeSession } from "../services/sessionAnalyzer.js";

const MAX_MESSAGE_LENGTH = 2000;
const SYSTEM_MESSAGES = ['[SESIÓN FINALIZADA]', '[SESION FINALIZADA]'];

function isSystemMessage(content: string): boolean {
  return SYSTEM_MESSAGES.some(sys => content.includes(sys));
}

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

function cleanFirestoreData(obj: any) {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined && v !== null));
}

/**
 * Lógica interna de guardado (separada para poder usarla como fire-and-forget).
 */
async function doSaveHistory(state: AgentStateType) {
  const { messages, clientId, agentId, userInfo, threadId, endSession } = state;

  if (!messages || messages.length === 0) return;

  const db = admin.firestore();
  const userId = userInfo?.phone || userInfo?.email || "anonymous";
  const userName = userInfo?.name || null;
  const docId = `conv_${agentId}_${userId}_${threadId}`;

  const serializableMessages = messages
    .filter(msg => {
      const role = msg instanceof HumanMessage ? 'user' : msg instanceof AIMessage ? 'assistant' : msg instanceof ToolMessage ? 'tool' : 'unknown';
      if (role === 'user' && isSystemMessage(msg.content as string)) return false;
      return true;
    })
    .map(msg => {
      let role = "unknown";
      if (msg instanceof HumanMessage) role = "user";
      else if (msg instanceof AIMessage) role = "assistant";
      else if (msg instanceof ToolMessage) role = "tool";

      return {
        role,
        content: cleanMessageContent(msg.content as string, role),
        timestamp: new Date().toISOString(),
      };
    });

  let summary: string | undefined;
  let classification: any = undefined;

  const userAndAssistantMessages = serializableMessages.filter(m => m.role === "user" || m.role === "assistant");
  const hasRealMessages = userAndAssistantMessages.some(m => m.role === 'user' && m.content && m.content.length > 5 && !isSystemMessage(m.content));

  if (endSession && hasRealMessages) {
    const now = new Date();
    const sessionDate = formatSessionDate(now);
    const analysis = await analyzeSession(userAndAssistantMessages, userName);
    summary = `[${sessionDate}] ${analysis.summary}`;
    classification = analysis.classification;
  }

  console.log('📝 Guardando historial:', { summary, classification });

  const docRef = db.collection("history").doc(docId);
  const docData: Record<string, any> = {
    clientId: clientId || "unknown",
    agentId: agentId || "unknown",
    userId,
    threadId,
    messages: serializableMessages,
    lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (userName) docData.userName = userName;
  if (typeof summary === 'string' && summary.trim() !== '') {
    docData.summary = summary;
  }
  if (classification && typeof classification === 'object') {
    docData.classification = classification;
  }
  await docRef.set(docData, { merge: false });
}

/**
 * Nodo de guardado de historial: fire-and-forget para no bloquear la respuesta al usuario.
 */
export async function saveHistoryNode(state: AgentStateType) {
  if (!state.messages || state.messages.length === 0) return {};

  // Fire-and-forget: el usuario recibe su respuesta sin esperar a que Firestore confirme
  doSaveHistory(state).catch(err => console.error("❌ Error en saveHistoryNode:", err));

  return {};
}
