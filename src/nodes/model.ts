import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { SystemMessage } from "@langchain/core/messages";
import { AgentStateType } from "../state/state.js";
import { tools } from "../tools/index.js";
import { SystemInstructionBuilder } from "../utils/SystemInstructionBuilder.js";

/**
 * Nodo de Modelo (Cerebro): Procesa el estado actual y decide la siguiente acción.
 * Utiliza Gemini 2.5 Flash Lite para un razonamiento rápido y eficiente.
 */
export async function modelNode(state: AgentStateType) {
  const { messages, functions, skills } = state;

  // 1. Filtrado dinámico de herramientas basado en la configuración de Firestore
  const legacyToNewMapping: Record<string, string> = {
    "search_knowledge": "knowledge_retriever",
    "search_products": "product_catalog",
    "schedule_meeting": "appointment_manager",
    "get_history": "history_retriever",
  };

  const allowedTools = tools.filter(tool => {
    if (functions.includes(tool.name)) return true;
    
    const isLegacyAllowed = Object.entries(legacyToNewMapping).some(([legacyName, actualName]) => 
      actualName === tool.name && functions.includes(legacyName)
    );

    if (isLegacyAllowed) return true;

    // Habilitar por Skills si corresponde
    if (skills.includes("knowledge") && tool.name === "knowledge_retriever") return true;
    if (skills.includes("sales") && tool.name === "product_catalog") return true;
    if (skills.includes("calendar") && tool.name === "appointment_manager") return true;
    if (skills.includes("history") && tool.name === "history_retriever") return true;

    return false;
  });

  // 2. Inicializar el modelo con el nombre oficial de la arquitectura Matrix 6.0
  const model = new ChatGoogleGenerativeAI({
    modelName: "gemini-2.5-flash-lite", 
    maxOutputTokens: 2048,
    apiKey: process.env.GEMINI_API_KEY,
  }).bindTools(allowedTools);

  // 3. Construir el System Prompt dinámico usando el Builder (Matrix 6.0)
  const systemPrompt = SystemInstructionBuilder.build(state);

  // 4. Preparar la cadena de mensajes
  const allMessages = [
    new SystemMessage(systemPrompt),
    ...messages
  ];

  // 5. Invocar al modelo
  const response = await model.invoke(allMessages);

  // LOG DE CONTROL (Solo para desarrollo)
  if (response.tool_calls && response.tool_calls.length > 0) {
    console.log(`🤖 Eva decidió usar: ${response.tool_calls.map(tc => tc.name).join(", ")}`);
  } else {
    console.log(`💬 Eva decidió responder directamente.`);
  }

  // 6. Retornar la actualización del estado
  return {
    messages: [response],
  };
}
