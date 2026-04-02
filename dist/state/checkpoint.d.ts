import { BaseCheckpointSaver, Checkpoint, CheckpointMetadata, CheckpointTuple } from "@langchain/langgraph-checkpoint";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { PendingWrite } from "@langchain/langgraph-checkpoint";
/**
 * Checkpointer personalizado para Firestore.
 * Implementa la persistencia de hilos (threads) de LangGraph directamente en tu DB.
 * Usa serde (JsonPlusSerializer) heredado de BaseCheckpointSaver para
 * serializar/deserializar correctamente los mensajes de LangChain (AIMessage, ToolMessage, etc.)
 */
export declare class FirestoreCheckpointer extends BaseCheckpointSaver {
    private db;
    private collectionName;
    constructor();
    private getThreadId;
    getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined>;
    list(config: RunnableConfig): AsyncGenerator<CheckpointTuple>;
    put(config: RunnableConfig, checkpoint: Checkpoint, metadata: CheckpointMetadata, _newVersions: Record<string, string | number>): Promise<RunnableConfig>;
    private stripTransientState;
    putWrites(_config: RunnableConfig, _writes: PendingWrite[], _taskId: string): Promise<void>;
}
