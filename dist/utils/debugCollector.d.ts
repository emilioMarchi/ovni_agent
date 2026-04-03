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
export declare function setActiveThread(threadId: string): void;
export declare function pushDebugEvent(event: DebugEvent, threadId?: string): void;
export declare function drainDebugEvents(threadId?: string): DebugEvent[];
export declare function clearDebugEvents(threadId?: string): void;
