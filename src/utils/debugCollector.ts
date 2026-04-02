/**
 * Collector thread-safe para debug events.
 * Las tools escriben aquí (por threadId) y toolNodeWithLogs lo drena al state.
 */

export interface DebugEvent {
  node: string;
  timestamp: string;
  type: string;
  data: Record<string, unknown>;
}

const store = new Map<string, DebugEvent[]>();

/** Genera un threadId-key para el collector */
let _activeThreadId = "";

export function setActiveThread(threadId: string) {
  _activeThreadId = threadId;
  if (!store.has(threadId)) store.set(threadId, []);
}

export function pushDebugEvent(event: DebugEvent, threadId?: string) {
  const key = threadId || _activeThreadId;
  if (!key) return;
  const bucket = store.get(key) || [];
  bucket.push(event);
  store.set(key, bucket);
}

export function drainDebugEvents(threadId?: string): DebugEvent[] {
  const key = threadId || _activeThreadId;
  if (!key) return [];
  const events = store.get(key) || [];
  store.delete(key);
  return events;
}

export function clearDebugEvents(threadId?: string) {
  const key = threadId || _activeThreadId;
  if (key) store.delete(key);
}
