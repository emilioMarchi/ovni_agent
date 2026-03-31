import admin from "firebase-admin";
import { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";
/**
 * Checkpointer personalizado para Firestore.
 * Implementa la persistencia de hilos (threads) de LangGraph directamente en tu DB.
 * Usa serde (JsonPlusSerializer) heredado de BaseCheckpointSaver para
 * serializar/deserializar correctamente los mensajes de LangChain (AIMessage, ToolMessage, etc.)
 */
export class FirestoreCheckpointer extends BaseCheckpointSaver {
    db;
    collectionName = "checkpoints";
    constructor() {
        super();
        this.db = admin.firestore();
    }
    getThreadId(config) {
        const threadId = config.configurable?.thread_id;
        if (typeof threadId !== "string" || !threadId) {
            throw new Error("Missing thread_id in checkpoint config");
        }
        return threadId;
    }
    async getTuple(config) {
        const thread_id = this.getThreadId(config);
        const doc = await this.db.collection(this.collectionName).doc(thread_id).get();
        if (!doc.exists)
            return undefined;
        const data = doc.data();
        let checkpoint;
        let metadata;
        if (data.serdeType) {
            // Formato nuevo: serializado con serde (JsonPlusSerializer)
            checkpoint = await this.serde.loadsTyped(data.serdeType, data.checkpoint);
            metadata = await this.serde.loadsTyped(data.metadataSerdeType || "json", data.metadata);
        }
        else {
            // Formato legacy: JSON puro — destruir y dejar que se re-cree limpio
            // No intentamos reconstruir messages viejos porque los tipos se pierden
            console.warn(`⚠️ [CHECKPOINT] Formato legacy detectado para thread ${thread_id}, descartando.`);
            return undefined;
        }
        return {
            config,
            checkpoint,
            metadata,
        };
    }
    async *list(config) {
        const thread_id = this.getThreadId(config);
        const snapshot = await this.db.collection(this.collectionName)
            .where("thread_id", "==", thread_id)
            .get();
        for (const doc of snapshot.docs) {
            const data = doc.data();
            if (!data.serdeType)
                continue; // Saltar legacy
            const checkpoint = await this.serde.loadsTyped(data.serdeType, data.checkpoint);
            const metadata = await this.serde.loadsTyped(data.metadataSerdeType || "json", data.metadata);
            yield {
                config: { configurable: { thread_id: data.thread_id } },
                checkpoint,
                metadata,
            };
        }
    }
    async put(config, checkpoint, metadata, _newVersions) {
        const thread_id = this.getThreadId(config);
        const [serdeType, serializedCheckpoint] = this.serde.dumpsTyped(checkpoint);
        const [metadataSerdeType, serializedMetadata] = this.serde.dumpsTyped(metadata);
        // Convertir Uint8Array a string para Firestore
        const checkpointStr = typeof serializedCheckpoint === "string"
            ? serializedCheckpoint
            : new TextDecoder().decode(serializedCheckpoint);
        const metadataStr = typeof serializedMetadata === "string"
            ? serializedMetadata
            : new TextDecoder().decode(serializedMetadata);
        await this.db.collection(this.collectionName).doc(thread_id).set({
            thread_id,
            serdeType,
            checkpoint: checkpointStr,
            metadataSerdeType,
            metadata: metadataStr,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { configurable: { thread_id } };
    }
    async putWrites(_config, _writes, _taskId) {
        return;
    }
}
//# sourceMappingURL=checkpoint.js.map