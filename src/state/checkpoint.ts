import admin from "firebase-admin";
import { BaseCheckpointSaver, Checkpoint, CheckpointMetadata, CheckpointTuple } from "@langchain/langgraph-checkpoint";

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

  async getTuple(config: any): Promise<CheckpointTuple | undefined> {
    const { thread_id } = config.configurable;
    const doc = await this.db.collection(this.collectionName).doc(thread_id).get();

    if (!doc.exists) return undefined;

    const data = doc.data()!;
    return {
      config,
      checkpoint: JSON.parse(data.checkpoint) as Checkpoint,
      metadata: JSON.parse(data.metadata || "{}") as CheckpointMetadata,
    };
  }

  async list(config: any): Promise<CheckpointTuple[]> {
    // Implementación básica para listar checkpoints de un hilo
    const { thread_id } = config.configurable;
    const snapshot = await this.db.collection(this.collectionName)
      .where("thread_id", "==", thread_id)
      .get();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        config: { configurable: { thread_id: data.thread_id } },
        checkpoint: JSON.parse(data.checkpoint),
        metadata: JSON.parse(data.metadata || "{}"),
      };
    });
  }

  async put(config: any, checkpoint: Checkpoint, metadata: CheckpointMetadata): Promise<any> {
    const { thread_id } = config.configurable;
    
    await this.db.collection(this.collectionName).doc(thread_id).set({
      thread_id,
      checkpoint: JSON.stringify(checkpoint),
      metadata: JSON.stringify(metadata),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { configurable: { thread_id } };
  }
}
