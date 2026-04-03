/**
 * Representa la información del usuario actual en la sesión.
 */
export interface UserInfo {
    name?: string;
    email?: string;
    phone?: string;
    metadata?: Record<string, any>;
}
/**
 * Definición del estado global del Agente OVNI v2.
 * Basado en LangGraph Annotation para una gestión de estado inmutable y persistente.
 */
export declare const AgentState: import("@langchain/langgraph").AnnotationRoot<{
    /**
     * Identificador único del cliente (empresa/negocio).
     */
    clientId: import("@langchain/langgraph").LastValue<string>;
    /**
     * Identificador del agente específico configurado.
     */
    agentId: import("@langchain/langgraph").LastValue<string>;
    /**
     * Nombre visible del agente configurado.
     */
    agentName: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    /**
     * Descripción funcional del agente.
     */
    agentDescription: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    /**
     * Nombre del negocio u organización dueña del agente.
     */
    organizationName: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    /**
     * Perfil del usuario final recuperado de Firestore.
     */
    userInfo: import("@langchain/langgraph").BinaryOperatorAggregate<UserInfo, UserInfo>;
    /**
     * Contexto del negocio cargado dinámicamente (ej: "Somos una tienda de ropa...").
     */
    businessContext: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    /**
     * Instrucciones específicas del sistema para este agente (personalidad, rol).
     */
    systemInstruction: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    /**
     * Lista de IDs de documentos que este agente tiene permitido consultar en el RAG.
     */
    allowedDocIds: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    /**
     * Habilidades (skills) habilitadas para este agente (ej: "knowledge", "sales").
     */
    skills: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    /**
     * Nombres de las funciones (tools) específicas que el agente puede invocar.
     */
    functions: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    /**
     * Estado interno de herramientas o flujos específicos (ej: "awaiting_payment", "idle").
     */
    flowState: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    /**
     * ID del hilo de conversación (thread_id) para persistencia.
     */
    threadId: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    /**
     * Flag para indicar fin de sesión (para generar resumen).
     */
    endSession: import("@langchain/langgraph").BinaryOperatorAggregate<boolean, boolean>;
    /**
     * Contexto recuperado del RAG (pre-fetch antes del modelo).
     */
    ragContext: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    /**
     * Flag para indicar que la respuesta debe incluir audio (TTS).
     */
    outputAudio: import("@langchain/langgraph").BinaryOperatorAggregate<boolean, boolean>;
    /**
     * Buffer de audio generado por TTS (si outputAudio es true).
     */
    audioBuffer: import("@langchain/langgraph").BinaryOperatorAggregate<Buffer<ArrayBufferLike> | null, Buffer<ArrayBufferLike> | null>;
    /**
     * Historial contextual recuperado de Firestore para enriquecer el contexto del modelo.
     */
    contextHistory: import("@langchain/langgraph").BinaryOperatorAggregate<{
        role: string;
        content: string;
        timestamp: string;
    }[], {
        role: string;
        content: string;
        timestamp: string;
    }[]>;
    /**
     * Query contextual para búsqueda semántica en el historial.
     */
    contextQuery: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    /**
     * Permite saltear procesos previos costosos para inputs simples sin intención clara.
     */
    fastPath: import("@langchain/langgraph").BinaryOperatorAggregate<boolean, boolean>;
    /**
     * Traza de debug: acumula eventos internos del grafo para inspección.
     * Solo se popula cuando el request viene con debug: true.
     */
    debugTrace: import("@langchain/langgraph").BinaryOperatorAggregate<Record<string, unknown>[], Record<string, unknown>[]>;
    /**
     * Flag para activar la recolección de debug trace.
     */
    debugMode: import("@langchain/langgraph").BinaryOperatorAggregate<boolean, boolean>;
    messages: import("@langchain/langgraph").BinaryOperatorAggregate<import("@langchain/core/messages").BaseMessage[], import("@langchain/langgraph").Messages>;
}>;
/**
 * Tipo derivado del estado para uso en los nodos del grafo.
 */
export type AgentStateType = typeof AgentState.State;
