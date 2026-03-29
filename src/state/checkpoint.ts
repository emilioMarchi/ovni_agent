import admin from "firebase-admin";
import { BaseCheckpointSaver, Checkpoint, CheckpointMetadata, CheckpointTuple } from "@langchain/langgraph-checkpoint";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { PendingWrite } from "@langchain/langgraph-checkpoint";

/**
 * Checkpointer personalizado para Firestore.
 * Implementa la persistencia de hilos (threads) de LangGraph directamente en tu DB.
 * Esto asegura que el Nivel 2 (Sesión/Historial) sea persistente entre reinicios.
 */
export class FirestoreCheckpointer extends BaseCheckpointSaver {
  private db: admin.firestore.Firestore;
  private collectionName = "checkpoints";

  constructor() {
    super();
    this.db = admin.firestore();
  }

  private getThreadId(config: RunnableConfig): string {
    const threadId = config.configurable?.thread_id;
    if (typeof threadId !== "string" || !threadId) {
      throw new Error("Missing thread_id in checkpoint config");
    }
    return threadId;
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const thread_id = this.getThreadId(config);
    const doc = await this.db.collection(this.collectionName).doc(thread_id).get();

    if (!doc.exists) return undefined;

    const data = doc.data()!;
    return {
      config,
      checkpoint: JSON.parse(data.checkpoint) as Checkpoint,
      metadata: JSON.parse(data.metadata || "{}") as CheckpointMetadata,
    };
  }

  async *list(config: RunnableConfig): AsyncGenerator<CheckpointTuple> {
    const thread_id = this.getThreadId(config);
    const snapshot = await this.db.collection(this.collectionName)
      .where("thread_id", "==", thread_id)
      .get();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      yield {
        config: { configurable: { thread_id: data.thread_id } },
        checkpoint: JSON.parse(data.checkpoint),
        metadata: JSON.parse(data.metadata || "{}"),
      };
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    _newVersions: Record<string, string | number>
  ): Promise<RunnableConfig> {
    const thread_id = this.getThreadId(config);
    
    await this.db.collection(this.collectionName).doc(thread_id).set({
      thread_id,
      checkpoint: JSON.stringify(checkpoint),
      metadata: JSON.stringify(metadata),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { configurable: { thread_id } };
  }

  async putWrites(_config: RunnableConfig, _writes: PendingWrite[], _taskId: string): Promise<void> {
    return;
  }
}
