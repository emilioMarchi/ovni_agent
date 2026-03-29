import admin from "firebase-admin";
/**
 * Recupera los últimos N mensajes relevantes de una conversación.
 * @param {string} threadId
 * @param {string} agentId
 * @param {number} limit
 * @returns {Promise<Array<{role: string, content: string, timestamp: string}>>}
 */
export async function getRecentMessages(threadId, agentId, limit = 15) {
    const db = admin.firestore();
    const snapshot = await db
        .collection("history")
        .where("threadId", "==", threadId)
        .where("agentId", "==", agentId)
        .limit(1)
        .get();
    if (snapshot.empty)
        return [];
    const doc = snapshot.docs[0];
    const data = doc.data();
    const messages = data.messages || [];
    // Solo user/assistant, últimos N
    return messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-limit);
}
//# sourceMappingURL=historyUtils.js.map