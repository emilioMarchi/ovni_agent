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
        const docRef = this.db.collection(this.collectionName).doc(thread_id);
        const doc = await docRef.get();
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
        if (this.hasMalformedMessages(checkpoint)) {
            console.warn(`⚠️ [CHECKPOINT] Checkpoint corrupto detectado para thread ${thread_id}, eliminando para recrearlo limpio.`);
            await docRef.delete().catch(() => { });
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
        const sanitizedCheckpoint = this.stripTransientState(checkpoint);
        // Truncamiento defensivo de mensajes y metadatos
        function truncateString(str, maxLength = 10000) {
            if (typeof str !== 'string')
                return str;
            return str.length > maxLength ? str.slice(0, maxLength) + '\n[TRUNCATED]' : str;
        }
        // ── Limpiar audioBuffer de metadata.writes ──
        // LangGraph registra en metadata.writes lo que cada nodo escribió al estado.
        // Cuando el nodo TTS produce audioBuffer (buffer binario grande), queda capturado
        // aquí y hace explotar el campo metadata en Firestore (>1 MB).
        let safeMetadata = { ...metadata };
        if (safeMetadata.writes && typeof safeMetadata.writes === 'object') {
            // writes puede ser Record<string, unknown> donde las keys son nombres de nodo
            // y los values son los state updates de ese nodo
            const cleanedWrites = {};
            for (const [nodeKey, nodeWrites] of Object.entries(safeMetadata.writes)) {
                if (nodeWrites && typeof nodeWrites === 'object' && !Array.isArray(nodeWrites)) {
                    const cleaned = { ...nodeWrites };
                    if ('audioBuffer' in cleaned) {
                        cleaned.audioBuffer = null;
                    }
                    cleanedWrites[nodeKey] = cleaned;
                }
                else if (Array.isArray(nodeWrites)) {
                    // writes puede ser un array de updates
                    cleanedWrites[nodeKey] = nodeWrites.map((w) => {
                        if (w && typeof w === 'object' && 'audioBuffer' in w) {
                            return { ...w, audioBuffer: null };
                        }
                        return w;
                    });
                }
                else {
                    cleanedWrites[nodeKey] = nodeWrites;
                }
            }
            safeMetadata.writes = cleanedWrites;
        }
        // Truncar campos string grandes en metadata
        for (const k of Object.keys(safeMetadata)) {
            if (typeof safeMetadata[k] === 'string' && safeMetadata[k].length > 8000) {
                safeMetadata[k] = truncateString(safeMetadata[k], 8000);
            }
        }
        const [serdeType, serializedCheckpoint] = this.serde.dumpsTyped(sanitizedCheckpoint);
        const [metadataSerdeType, serializedMetadata] = this.serde.dumpsTyped(safeMetadata);
        // Convertir Uint8Array a string para Firestore
        const checkpointStr = typeof serializedCheckpoint === "string"
            ? serializedCheckpoint
            : new TextDecoder().decode(serializedCheckpoint);
        const metadataStr = typeof serializedMetadata === "string"
            ? serializedMetadata
            : new TextDecoder().decode(serializedMetadata);
        // Log defensivo de tamaños
        const checkpointSize = checkpointStr.length;
        const metadataSize = metadataStr.length;
        if (checkpointSize > 900000 || metadataSize > 900000) {
            console.warn(`[CHECKPOINT] Tamaño grande detectado: checkpoint=${checkpointSize}, metadata=${metadataSize}`);
        }
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
    stripTransientState(checkpoint) {
        const checkpointWithChannels = checkpoint;
        const clone = {
            ...checkpoint,
            channel_values: {
                ...(checkpointWithChannels.channel_values || {}),
            },
        };
        if (clone.channel_values) {
            // El audio TTS es transitorio: se usa para responder al cliente, pero no debe
            // persistirse en Firestore porque hace crecer el checkpoint por encima de 1 MB.
            if ("audioBuffer" in clone.channel_values) {
                clone.channel_values.audioBuffer = null;
            }
        }
        return clone;
    }
    hasMalformedMessages(checkpoint) {
        const channelValues = checkpoint.channel_values;
        const messages = Array.isArray(channelValues?.messages)
            ? channelValues.messages
            : [];
        return messages.some((message) => {
            if (!message || typeof message !== "object") {
                return false;
            }
            const candidate = message;
            return typeof candidate._getType !== "function" && candidate.lc_serializable === true;
        });
    }
    async putWrites(_config, _writes, _taskId) {
        return;
    }
}
//# sourceMappingURL=checkpoint.js.map