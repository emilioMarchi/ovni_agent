/**
 * Recupera mensajes más antiguos de la conversación (segunda capa).
 * @param {string} threadId
 * @param {number} skip
 * @param {number} limit
 * @returns {Promise<Array<{role: string, content: string, timestamp: string}>>}
 */
export declare function getOlderMessages(threadId: string, skip?: number, limit?: number): Promise<any>;
/**
 * Simulación de búsqueda semántica (placeholder, reemplazar por embeddings reales).
 * @param {string} userId
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<Array<{role: string, content: string, timestamp: string}>>}
 */
export declare function semanticSearchHistory(userId: string, query: string, limit?: number): Promise<any[]>;
