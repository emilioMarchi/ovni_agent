import { Annotation, MessagesAnnotation } from "@langchain/langgraph";
/**
 * Definición del estado global del Agente OVNI v2.
 * Basado en LangGraph Annotation para una gestión de estado inmutable y persistente.
 */
export const AgentState = Annotation.Root({
    /**
     * Historial de mensajes de la conversación.
     * Utiliza el reducer predefinido de LangGraph para añadir y actualizar mensajes.
     */
    ...MessagesAnnotation.spec,
    /**
     * Identificador único del cliente (empresa/negocio).
     */
    clientId: Annotation(),
    /**
     * Identificador del agente específico configurado.
     */
    agentId: Annotation(),
    /**
     * Perfil del usuario final recuperado de Firestore.
     */
    userInfo: Annotation({
        reducer: (old, newest) => ({ ...old, ...newest }),
        default: () => ({}),
    }),
    /**
     * Contexto del negocio cargado dinámicamente (ej: "Somos una tienda de ropa...").
     */
    businessContext: Annotation({
        reducer: (old, newest) => newest ?? old,
        default: () => "",
    }),
    /**
     * Instrucciones específicas del sistema para este agente (personalidad, rol).
     */
    systemInstruction: Annotation({
        reducer: (old, newest) => newest ?? old,
        default: () => "",
    }),
    /**
     * Lista de IDs de documentos que este agente tiene permitido consultar en el RAG.
     */
    allowedDocIds: Annotation({
        reducer: (old, newest) => newest ?? old,
        default: () => [],
    }),
    /**
     * Habilidades (skills) habilitadas para este agente (ej: "knowledge", "sales").
     */
    skills: Annotation({
        reducer: (old, newest) => newest ?? old,
        default: () => [],
    }),
    /**
     * Nombres de las funciones (tools) específicas que el agente puede invocar.
     */
    functions: Annotation({
        reducer: (old, newest) => newest ?? old,
        default: () => [],
    }),
    /**
     * Estado interno de herramientas o flujos específicos (ej: "awaiting_payment", "idle").
     */
    flowState: Annotation({
        reducer: (old, newest) => newest ?? old,
        default: () => "idle",
    }),
    /**
     * ID del hilo de conversación (thread_id) para persistencia.
     */
    threadId: Annotation({
        reducer: (old, newest) => newest ?? old,
        default: () => "",
    }),
    /**
     * Flag para indicar fin de sesión (para generar resumen).
     */
    endSession: Annotation({
        reducer: (old, newest) => newest ?? old,
        default: () => false,
    }),
    /**
     * Contexto recuperado del RAG (pre-fetch antes del modelo).
     */
    ragContext: Annotation({
        reducer: (old, newest) => newest ?? old,
        default: () => "",
    }),
    /**
     * Flag para indicar que la respuesta debe incluir audio (TTS).
     */
    outputAudio: Annotation({
        reducer: (old, newest) => newest ?? old,
        default: () => false,
    }),
    /**
     * Buffer de audio generado por TTS (si outputAudio es true).
     */
    audioBuffer: Annotation({
        reducer: (_, newest) => newest ?? null,
        default: () => null,
    }),
    /**
     * Historial contextual recuperado de Firestore para enriquecer el contexto del modelo.
     */
    contextHistory: Annotation({
        reducer: (old, newest) => newest ?? old,
        default: () => [],
    }),
    /**
     * Query contextual para búsqueda semántica en el historial.
     */
    contextQuery: Annotation({
        reducer: (old, newest) => newest ?? old,
        default: () => "",
    }),
    /**
     * Permite saltear procesos previos costosos para inputs simples sin intención clara.
     */
    fastPath: Annotation({
        reducer: (old, newest) => newest ?? old,
        default: () => false,
    }),
});
//# sourceMappingURL=state.js.map