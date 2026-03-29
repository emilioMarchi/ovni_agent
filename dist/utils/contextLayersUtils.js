import admin from "firebase-admin";
/**
 * Recupera mensajes más antiguos de la conversación (segunda capa).
 * @param {string} threadId
 * @param {number} skip
 * @param {number} limit
 * @returns {Promise<Array<{role: string, content: string, timestamp: string}>>}
 */
export async function getOlderMessages(threadId, skip = 15, limit = 15) {
    const db = admin.firestore();
    const snapshot = await db
        .collection("history")
        .where("threadId", "==", threadId)
        .limit(1)
        .get();
    if (snapshot.empty)
        return [];
    const doc = snapshot.docs[0];
    const data = doc.data();
    const messages = data.messages || [];
    // Solo user/assistant, omitir los más recientes
    return messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-(skip + limit), -skip || undefined);
}
/**
 * Simulación de búsqueda semántica (placeholder, reemplazar por embeddings reales).
 * @param {string} userId
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<Array<{role: string, content: string, timestamp: string}>>}
 */
export async function semanticSearchHistory(userId, query, limit = 10) {
    // TODO: Integrar motor de embeddings real
    // Por ahora, solo busca mensajes que contengan la query (case-insensitive)
    const db = admin.firestore();
    const snapshot = await db
        .collection("history")
        .where("userId", "==", userId)
        .get();
    let results = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        const messages = data.messages || [];
        results = results.concat(messages.filter((m) => (m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string" &&
            m.content.toLowerCase().includes(query.toLowerCase())));
    });
    // Ordenar por timestamp descendente y limitar
    results.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    return results.slice(0, limit);
}
//# sourceMappingURL=contextLayersUtils.js.map