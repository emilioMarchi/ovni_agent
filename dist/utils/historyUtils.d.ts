/**
 * Recupera los últimos N mensajes relevantes de una conversación.
 * @param {string} threadId
 * @param {string} agentId
 * @param {number} limit
 * @returns {Promise<Array<{role: string, content: string, timestamp: string}>>}
 */
export declare function getRecentMessages(threadId: string, agentId: string, limit?: number): Promise<any>;
