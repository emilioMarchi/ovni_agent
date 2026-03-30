import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { AgentStateType } from "../state/state.js";
import { tools } from "../tools/index.js";
import { SystemInstructionBuilder } from "../utils/SystemInstructionBuilder.js";

export async function modelNode(state: AgentStateType) {
  const { messages, functions, skills } = state;
  const lastMessage = messages[messages.length - 1];

  if (lastMessage instanceof ToolMessage) {
    const toolName = (lastMessage as any).name || "";
    const toolContent = typeof lastMessage.content === "string" ? lastMessage.content : String(lastMessage.content || "");

    if (toolName === "availability_checker" && toolContent.trim()) {
      console.log(`💬 [MODEL] Respuesta directa desde tool ${toolName}.`);
      return {
        messages: [new AIMessage(toolContent)],
      };
    }
  }

  const legacyToNewMapping: Record<string, string> = {
    "search_knowledge": "knowledge_retriever",
    "search_products": "product_catalog",
    "schedule_meeting": "appointment_manager",
    "get_history": "history_retriever",
  };

  const allowedTools = tools.filter(tool => {
    if (tool.name === "context_manager") return true;

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

    return false;
  });

  console.log("🛠️ [MODEL] Skills del agente:", skills);
  console.log("🛠️ [MODEL] Functions del agente:", functions);
  console.log("🛠️ [MODEL] Tools filtradas:", allowedTools.map(t => t.name));

  const baseModel = new ChatGoogleGenerativeAI({
    modelName: "gemini-2.5-flash", 
    maxOutputTokens: state.outputAudio ? 800 : 2048,
    temperature: 0.3,
    apiKey: process.env.GEMINI_API_KEY,
  });

  const modelWithTools = baseModel.bindTools(allowedTools);

  const systemPrompt = SystemInstructionBuilder.build(state);

  const allMessages = [
    new SystemMessage(systemPrompt),
    ...messages
  ];

  const response = await modelWithTools.invoke(allMessages);

  if (response.tool_calls && response.tool_calls.length > 0) {
    console.log(`🤖 Eva decidió usar: ${response.tool_calls.map((tc: any) => tc.name).join(", ")}`);
  } else {
    console.log(`💬 Eva decidió responder directamente.`);
  }

  return {
    messages: [response],
  };
}
