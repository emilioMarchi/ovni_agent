import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { AIMessage, SystemMessage, ToolMessage, HumanMessage } from "@langchain/core/messages";
import { AgentStateType } from "../state/state.js";
import { tools } from "../tools/index.js";
import { SystemInstructionBuilder } from "../utils/SystemInstructionBuilder.js";
import { pushDebugEvent, drainDebugEvents } from "../utils/debugCollector.js";

export async function modelNode(state: AgentStateType) {
  const { messages, functions, skills, contextHistory = [] } = state;

  const legacyToNewMapping: Record<string, string> = {
    "search_knowledge": "knowledge_retriever",
    "search_products": "product_catalog",
    "schedule_meeting": "appointment_manager",
    "get_history": "history_retriever",
  };

  const { allowedDocIds = [] } = state;

  const allowedTools = tools.filter(tool => {
    if (tool.name === "context_manager") return true;

    // No ofrecer knowledge_retriever si el agente no tiene documentos asignados
    if (tool.name === "knowledge_retriever" && allowedDocIds.length === 0) return false;

    if (functions.includes(tool.name)) return true;
    
    const isLegacyAllowed = Object.entries(legacyToNewMapping).some(([legacyName, actualName]) => 
      actualName === tool.name && functions.includes(legacyName)
    );

    if (isLegacyAllowed) return true;

    if (skills.includes("knowledge") && tool.name === "knowledge_retriever") return true;
    if (skills.includes("sales") && tool.name === "product_catalog") return true;
    if (skills.includes("calendar") && tool.name === "appointment_manager") return true;
    if (skills.includes("calendar") && tool.name === "context_manager") return true;
    if (skills.includes("sales") && tool.name === "context_manager") return true;
    if (skills.includes("history") && tool.name === "history_retriever") return true;
    if (skills.includes("analysis") && tool.name === "document_analyzer") return true;
    if (skills.includes("analysis") && tool.name === "knowledge_retriever") return true;

    return false;
  });

  let modelWithTools: any;

  if (process.env.LLM_PROVIDER === "openrouter") {
    const openRouterModel = process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-ultra-550b-a55b:free";
    const fallbackModelNames = process.env.OPENROUTER_FALLBACK_MODELS ? process.env.OPENROUTER_FALLBACK_MODELS.split(",") : [];
    
    const createOpenRouterModel = (model: string) => {
      return new ChatOpenAI({
        modelName: model,
        openAIApiKey: process.env.OPENROUTER_API_KEY,
        temperature: 0.4,
        maxTokens: state.outputAudio ? 800 : (state.functions?.includes("document_analyzer") ? 16384 : 4096),
        configuration: {
          baseURL: "https://openrouter.ai/api/v1",
          baseOptions: {
            headers: {
              "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "",
              "X-Title": process.env.OPENROUTER_SITE_NAME || "OvniAgent",
            },
          },
        },
      });
    };

    const primaryModel = createOpenRouterModel(openRouterModel).bindTools(allowedTools);
    
    if (fallbackModelNames.length > 0) {
      const fallbacks = fallbackModelNames.map(name => createOpenRouterModel(name).bindTools(allowedTools));
      modelWithTools = primaryModel.withFallbacks({ fallbacks });
    } else {
      modelWithTools = primaryModel;
    }
  } else {
    const baseModel = new ChatGoogleGenerativeAI({
      modelName: "gemini-2.5-flash", 
      maxOutputTokens: state.outputAudio ? 800 : (state.functions?.includes("document_analyzer") ? 16384 : 4096),
      temperature: 0.4,
      apiKey: process.env.GEMINI_API_KEY,
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT" as any, threshold: "BLOCK_NONE" as any },
        { category: "HARM_CATEGORY_HATE_SPEECH" as any, threshold: "BLOCK_NONE" as any },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT" as any, threshold: "BLOCK_NONE" as any },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT" as any, threshold: "BLOCK_NONE" as any },
      ],
    });
    modelWithTools = baseModel.bindTools(allowedTools);
  }

  const systemPrompt = SystemInstructionBuilder.build(state);

  // Formatear historial pasado para inyectarlo como contexto extra si existe
  const formattedHistory = contextHistory.length > 0 
    ? "\n\n--- MEMORIA DE SESIONES ANTERIORES ---\n" + 
      contextHistory.map(m => `${m.role === "user" ? "Usuario" : "Agente"} (${m.timestamp}): ${m.content}`).join("\n") +
      "\n--------------------------------------\n"
    : "";

  // 1. Filtrado inicial y limpieza de mensajes vacíos
  const filteredMessages = (messages || []).filter(msg => {
    if (!msg) return false;
    return (msg.content && msg.content !== "") || ((msg as any).tool_calls && (msg as any).tool_calls.length > 0);
  });

  // 2. Saneamiento de secuencia para Gemini y OpenAI (Evitar crashes de la librería y errores de IDs faltantes)
  const sanitizedMessages: any[] = [];
  for (let i = 0; i < filteredMessages.length; i++) {
    const msg = filteredMessages[i];
    const prevMsg = sanitizedMessages[sanitizedMessages.length - 1];

    // A. Evitar mensajes consecutivos del mismo rol (Colapsar)
    if (prevMsg) {
      const currentRole = msg instanceof HumanMessage ? 'human' : msg instanceof AIMessage ? 'ai' : msg instanceof ToolMessage ? 'tool' : 'unknown';
      const prevRole = prevMsg instanceof HumanMessage ? 'human' : prevMsg instanceof AIMessage ? 'ai' : prevMsg instanceof ToolMessage ? 'tool' : 'unknown';

      if (currentRole === prevRole && currentRole !== 'tool') {
        // Si es el mismo rol, concatenamos el contenido al mensaje anterior en lugar de añadir uno nuevo
        if (prevMsg.content && typeof prevMsg.content === 'string') {
          prevMsg.content += `\n${msg.content || ""}`;
          continue;
        }
      }
    }

    // B. Asegurar IDs en tool_calls de AIMessage
    if (msg instanceof AIMessage && msg.tool_calls && msg.tool_calls.length > 0) {
      msg.tool_calls = msg.tool_calls.map((tc: any) => {
        if (!tc.id) {
          // Buscar si hay un ToolMessage correspondiente adelante para reutilizar su ID
          let toolCallId = undefined;
          for (let j = i + 1; j < filteredMessages.length; j++) {
            const nextMsg = filteredMessages[j];
            if (nextMsg instanceof ToolMessage && nextMsg.name === tc.name) {
              toolCallId = nextMsg.tool_call_id;
              break;
            }
            if (nextMsg instanceof AIMessage || nextMsg instanceof HumanMessage) {
              break;
            }
          }
          tc.id = toolCallId || `call_${Math.random().toString(36).substring(2, 15)}`;
        }
        return tc;
      });
    }

    // C. Validar ToolMessages: Debe haber un AIMessage con tool_calls justo antes, y sincronizar IDs
    if (msg instanceof ToolMessage) {
      if (!prevMsg || !(prevMsg instanceof AIMessage) || !prevMsg.tool_calls || prevMsg.tool_calls.length === 0) {
        console.warn(`[MODEL] Eliminando ToolMessage huérfano (sin llamada previa). Evitando crash de librería.`);
        continue; // Saltamos este mensaje porque rompería la secuencia de Gemini
      }

      // Asegurar que el ToolMessage tenga el tool_call_id correcto sincronizado con el AIMessage anterior
      if (!msg.tool_call_id) {
        const matchingCall = prevMsg.tool_calls.find((tc: any) => tc.name === msg.name);
        if (matchingCall) {
          msg.tool_call_id = matchingCall.id || `call_${Math.random().toString(36).substring(2, 15)}`;
        } else {
          // Si no encontramos correspondencia directa por nombre, usamos el ID de la primera tool call disponible
          msg.tool_call_id = prevMsg.tool_calls[0].id || `call_${Math.random().toString(36).substring(2, 15)}`;
        }
      }
    }

    sanitizedMessages.push(msg);
  }

  const allMessages = [
    new SystemMessage(systemPrompt + (formattedHistory ? "\n" + formattedHistory : "")),
    ...sanitizedMessages
  ];

  let response;
  let attempts = 0;
  const maxAttempts = 3; // Aumentamos a 3 para incluir el intento de limpieza
  let currentMessages = [...allMessages];

  while (attempts < maxAttempts) {
    try {
      response = await modelWithTools.invoke(currentMessages);
      break; // Éxito, salimos del bucle
    } catch (err) {
      attempts++;
      const isLibraryError = err instanceof TypeError && err.message.includes("reading 'length'");
      
      if (isLibraryError) {
        if (attempts === 2) {
          console.warn(`[MODEL] El error persiste tras el primer reintento. Aplicando LIMPIEZA DE EMERGENCIA al historial...`);
          // Mantenemos solo el SystemMessage (índice 0) y el último mensaje del usuario
          const systemMsg = currentMessages[0];
          const lastUserMsg = currentMessages[currentMessages.length - 1];
          currentMessages = [systemMsg, lastUserMsg];
          console.log(`[MODEL] Historial simplificado a ${currentMessages.length} mensajes para evitar crash de librería.`);
          continue;
        }
        if (attempts < maxAttempts) {
          console.warn(`[MODEL] Error de librería detectado. Reintentando (${attempts}/${maxAttempts})...`);
          continue; 
        }
      }

      console.error(`[MODEL] Error invoking model (Attempt ${attempts}):`, err);
      console.error("[MODEL] Debug - All Messages count:", currentMessages.length);
      console.error("[MODEL] Debug - Message types:", currentMessages.map(m => m.constructor.name));
      
      return {
        messages: [new AIMessage("Lo siento, hubo un error al procesar tu mensaje. Intenta de nuevo más tarde.")],
      };
    }
  }

  if (response && Array.isArray(response.tool_calls) && response.tool_calls.length > 0) {
    console.log(`🤖 Eva decidió usar: ${response.tool_calls.map((tc: any) => tc.name).join(", ")}`);
  } else {
    console.log(`💬 Eva decidió responder directamente.`);
  }

  // Emit debug event for model decision
  if (state.debugMode) {
    pushDebugEvent({
      node: "model",
      timestamp: new Date().toISOString(),
      type: "llm_decision",
      data: {
        allowedTools: allowedTools.map(t => t.name),
        toolCalls: response?.tool_calls?.map((tc: any) => ({ name: tc.name, args: tc.args })) || [],
        respondedDirectly: !response?.tool_calls?.length,
        responsePreview: !response?.tool_calls?.length ? (response?.content as string)?.substring(0, 300) : undefined,
      },
    });
  }

  if (!response || typeof response !== "object" || !("content" in response)) {
    return {
      messages: [new AIMessage("Lo siento, no se pudo obtener una respuesta válida del modelo.")],
    };
  }

  const modelReturn: Record<string, unknown> = {
    messages: [response],
  };

  // If debug mode and no tool calls (direct response), drain events now
  if (state.debugMode) {
    const events = drainDebugEvents();
    if (events.length > 0) {
      modelReturn.debugTrace = events;
    }
  }

  return modelReturn;
}