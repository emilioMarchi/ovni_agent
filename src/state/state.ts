import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

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
export const AgentState = Annotation.Root({
  /**
   * Historial de mensajes de la conversación.
   * Utiliza el reducer predefinido de LangGraph para añadir y actualizar mensajes.
   */
  ...MessagesAnnotation.spec,

  /**
   * Identificador único del cliente (empresa/negocio).
   */
  clientId: Annotation<string>(),

  /**
   * Identificador del agente específico configurado.
   */
  agentId: Annotation<string>(),

  /**
   * Perfil del usuario final recuperado de Firestore.
   */
  userInfo: Annotation<UserInfo>({
    reducer: (old, newest) => ({ ...old, ...newest }),
    default: () => ({}),
  }),

  /**
   * Contexto del negocio cargado dinámicamente (ej: "Somos una tienda de ropa...").
   */
  businessContext: Annotation<string>({
    reducer: (old, newest) => newest ?? old,
    default: () => "",
  }),

  /**
   * Instrucciones específicas del sistema para este agente (personalidad, rol).
   */
  systemInstruction: Annotation<string>({
    reducer: (old, newest) => newest ?? old,
    default: () => "",
  }),

  /**
   * Lista de IDs de documentos que este agente tiene permitido consultar en el RAG.
   */
  allowedDocIds: Annotation<string[]>({
    reducer: (old, newest) => newest ?? old,
    default: () => [],
  }),

  /**
   * Habilidades (skills) habilitadas para este agente (ej: "knowledge", "sales").
   */
  skills: Annotation<string[]>({
    reducer: (old, newest) => newest ?? old,
    default: () => [],
  }),

  /**
   * Nombres de las funciones (tools) específicas que el agente puede invocar.
   */
  functions: Annotation<string[]>({
    reducer: (old, newest) => newest ?? old,
    default: () => [],
  }),

/**
 * Estado interno de herramientas o flujos específicos (ej: "awaiting_payment", "idle").
 */
  flowState: Annotation<string>({
    reducer: (old, newest) => newest ?? old,
    default: () => "idle",
  }),

  /**
   * ID del hilo de conversación (thread_id) para persistencia.
   */
  threadId: Annotation<string>({
    reducer: (old, newest) => newest ?? old,
    default: () => "",
  }),

  /**
   * Flag para indicar fin de sesión (para generar resumen).
   */
  endSession: Annotation<boolean>({
    reducer: (old, newest) => newest ?? old,
    default: () => false,
  }),

  /**
   * Contexto recuperado del RAG (pre-fetch antes del modelo).
   */
  ragContext: Annotation<string>({
    reducer: (old, newest) => newest ?? old,
    default: () => "",
  }),
});

/**
 * Tipo derivado del estado para uso en los nodos del grafo.
 */
export type AgentStateType = typeof AgentState.State;
