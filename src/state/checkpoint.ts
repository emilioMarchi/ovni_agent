import admin from "firebase-admin";
import { BaseCheckpointSaver, Checkpoint, CheckpointMetadata, CheckpointTuple } from "@langchain/langgraph-checkpoint";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { PendingWrite } from "@langchain/langgraph-checkpoint";

/**
 * Checkpointer personalizado para Firestore.
 * Implementa la persistencia de hilos (threads) de LangGraph directamente en tu DB.
 * Usa serde (JsonPlusSerializer) heredado de BaseCheckpointSaver para
 * serializar/deserializar correctamente los mensajes de LangChain (AIMessage, ToolMessage, etc.)
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
    const docRef = this.db.collection(this.collectionName).doc(thread_id);
    const doc = await docRef.get();

    if (!doc.exists) return undefined;

    const data = doc.data()!;

    let checkpoint: Checkpoint;
    let metadata: CheckpointMetadata;

    if (data.serdeType) {
      // Formato nuevo: serializado con serde (JsonPlusSerializer)
      checkpoint = await this.serde.loadsTyped(data.serdeType, data.checkpoint) as Checkpoint;
      metadata = await this.serde.loadsTyped(data.metadataSerdeType || "json", data.metadata) as CheckpointMetadata;
    } else {
      // Formato legacy: JSON puro — destruir y dejar que se re-cree limpio
      // No intentamos reconstruir messages viejos porque los tipos se pierden
      console.warn(`⚠️ [CHECKPOINT] Formato legacy detectado para thread ${thread_id}, descartando.`);
      return undefined;
    }

    if (this.hasMalformedMessages(checkpoint)) {
      console.warn(`⚠️ [CHECKPOINT] Checkpoint corrupto detectado para thread ${thread_id}, eliminando para recrearlo limpio.`);
      await docRef.delete().catch(() => {});
      return undefined;
    }

    return {
      config,
      checkpoint,
      metadata,
    };
  }

  async *list(config: RunnableConfig): AsyncGenerator<CheckpointTuple> {
    const thread_id = this.getThreadId(config);
    const snapshot = await this.db.collection(this.collectionName)
      .where("thread_id", "==", thread_id)
      .get();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (!data.serdeType) continue; // Saltar legacy

      const checkpoint = await this.serde.loadsTyped(data.serdeType, data.checkpoint) as Checkpoint;
      const metadata = await this.serde.loadsTyped(data.metadataSerdeType || "json", data.metadata) as CheckpointMetadata;

      yield {
        config: { configurable: { thread_id: data.thread_id } },
        checkpoint,
        metadata,
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

    const sanitizedCheckpoint = this.stripTransientState(checkpoint);

    // Truncamiento defensivo de mensajes y metadatos
    function truncateString(str: string, maxLength = 10000): string {
      if (typeof str !== 'string') return str;
      return str.length > maxLength ? str.slice(0, maxLength) + '\n[TRUNCATED]' : str;
    }

    // Truncar mensajes muy largos en checkpoint
    if (sanitizedCheckpoint && Array.isArray(sanitizedCheckpoint.channel_values?.messages)) {
      sanitizedCheckpoint.channel_values.messages = sanitizedCheckpoint.channel_values.messages.map((msg) => {
        if (msg && typeof msg === 'object' && typeof msg.content === 'string') {
          return { ...msg, content: truncateString(msg.content, 12000) };
        }
        return msg;
      });
    }

    // Truncar response_metadata y additional_kwargs si existen
    if (sanitizedCheckpoint && Array.isArray(sanitizedCheckpoint.channel_values?.messages)) {
      sanitizedCheckpoint.channel_values.messages = sanitizedCheckpoint.channel_values.messages.map((msg) => {
        let patched = { ...msg };
        if (patched.response_metadata && typeof patched.response_metadata === 'object') {
          for (const k in patched.response_metadata) {
            if (typeof patched.response_metadata[k] === 'string') {
              patched.response_metadata[k] = truncateString(patched.response_metadata[k], 8000);
            }
          }
        }
        if (patched.additional_kwargs && typeof patched.additional_kwargs === 'object') {
          for (const k in patched.additional_kwargs) {
            if (typeof patched.additional_kwargs[k] === 'string') {
              patched.additional_kwargs[k] = truncateString(patched.additional_kwargs[k], 8000);
            }
          }
        }
        return patched;
      });
    }

    // Truncar metadata si es string
    let safeMetadata: any = metadata;
    if (typeof metadata === 'string') {
      safeMetadata = truncateString(metadata, 12000);
    } else if (metadata && typeof metadata === 'object') {
      // Truncar campos string grandes en metadata (solo si tiene índice string)
      safeMetadata = { ...metadata } as Record<string, any>;
      for (const k of Object.keys(safeMetadata)) {
        if (typeof safeMetadata[k] === 'string') {
          safeMetadata[k] = truncateString(safeMetadata[k], 8000);
        }
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

  private stripTransientState(checkpoint: Checkpoint): Checkpoint {
    const checkpointWithChannels = checkpoint as Checkpoint & {
      channel_values?: Record<string, unknown>;
    };

    const clone = {
      ...checkpoint,
      channel_values: {
        ...(checkpointWithChannels.channel_values || {}),
      },
    } as Checkpoint & {
      channel_values?: Record<string, unknown>;
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

  private hasMalformedMessages(checkpoint: Checkpoint): boolean {
    const channelValues = (checkpoint as Checkpoint & {
      channel_values?: Record<string, unknown>;
    }).channel_values;

    const messages = Array.isArray(channelValues?.messages)
      ? channelValues.messages
      : [];

    return messages.some((message) => {
      if (!message || typeof message !== "object") {
        return false;
      }

      const candidate = message as Record<string, unknown> & {
        _getType?: unknown;
        lc_serializable?: unknown;
      };

      return typeof candidate._getType !== "function" && candidate.lc_serializable === true;
    });
  }

  async putWrites(_config: RunnableConfig, _writes: PendingWrite[], _taskId: string): Promise<void> {
    return;
  }
}
