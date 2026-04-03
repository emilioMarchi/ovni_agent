/**
 * Collector thread-safe para debug events.
 * Las tools escriben aquí (por threadId) y toolNodeWithLogs lo drena al state.
 */
const store = new Map();
/** Genera un threadId-key para el collector */
let _activeThreadId = "";
export function setActiveThread(threadId) {
    _activeThreadId = threadId;
    if (!store.has(threadId))
        store.set(threadId, []);
}
export function pushDebugEvent(event, threadId) {
    const key = threadId || _activeThreadId;
    if (!key)
        return;
    const bucket = store.get(key) || [];
    bucket.push(event);
    store.set(key, bucket);
}
export function drainDebugEvents(threadId) {
    const key = threadId || _activeThreadId;
    if (!key)
        return [];
    const events = store.get(key) || [];
    store.delete(key);
    return events;
}
export function clearDebugEvents(threadId) {
    const key = threadId || _activeThreadId;
    if (key)
        store.delete(key);
}
//# sourceMappingURL=debugCollector.js.map