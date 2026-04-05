import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AIMessage, SystemMessage } from "@langchain/core/messages";
import { tools } from "../tools/index.js";
import { SystemInstructionBuilder } from "../utils/SystemInstructionBuilder.js";
import { pushDebugEvent, drainDebugEvents } from "../utils/debugCollector.js";
export async function modelNode(state) {
    const { messages, functions, skills, contextHistory = [] } = state;
    const legacyToNewMapping = {
        "search_knowledge": "knowledge_retriever",
        "search_products": "product_catalog",
        "schedule_meeting": "appointment_manager",
        "get_history": "history_retriever",
    };
    const { allowedDocIds = [] } = state;
    const allowedTools = tools.filter(tool => {
        if (tool.name === "context_manager")
            return true;
        // No ofrecer knowledge_retriever si el agente no tiene documentos asignados
        if (tool.name === "knowledge_retriever" && allowedDocIds.length === 0)
            return false;
        if (functions.includes(tool.name))
            return true;
        const isLegacyAllowed = Object.entries(legacyToNewMapping).some(([legacyName, actualName]) => actualName === tool.name && functions.includes(legacyName));
        if (isLegacyAllowed)
            return true;
        if (skills.includes("knowledge") && tool.name === "knowledge_retriever")
            return true;
        if (skills.includes("sales") && tool.name === "product_catalog")
            return true;
        if (skills.includes("calendar") && tool.name === "appointment_manager")
            return true;
        if (skills.includes("calendar") && tool.name === "context_manager")
            return true;
        if (skills.includes("sales") && tool.name === "context_manager")
            return true;
        if (skills.includes("history") && tool.name === "history_retriever")
            return true;
        if (skills.includes("analysis") && tool.name === "document_analyzer")
            return true;
        if (skills.includes("analysis") && tool.name === "knowledge_retriever")
            return true;
        return false;
    });
    const baseModel = new ChatGoogleGenerativeAI({
        modelName: "gemini-2.5-flash",
        maxOutputTokens: state.outputAudio ? 800 : (state.functions?.includes("document_analyzer") ? 16384 : 4096),
        temperature: 0.4,
        apiKey: process.env.GEMINI_API_KEY,
    });
    const modelWithTools = baseModel.bindTools(allowedTools);
    const systemPrompt = SystemInstructionBuilder.build(state);
    // Formatear historial pasado para inyectarlo como contexto extra si existe
    const formattedHistory = contextHistory.length > 0
        ? "\n\n--- MEMORIA DE SESIONES ANTERIORES ---\n" +
            contextHistory.map(m => `${m.role === "user" ? "Usuario" : "Agente"} (${m.timestamp}): ${m.content}`).join("\n") +
            "\n--------------------------------------\n"
        : "";
    const allMessages = [
        new SystemMessage(systemPrompt + formattedHistory),
        ...messages
    ];
    let response;
    try {
        response = await modelWithTools.invoke(allMessages);
    }
    catch (err) {
        console.error("[MODEL] Error invoking model:", err);
        return {
            messages: [new AIMessage("Lo siento, hubo un error al procesar tu mensaje. Intenta de nuevo más tarde.")],
        };
    }
    if (response && Array.isArray(response.tool_calls) && response.tool_calls.length > 0) {
        console.log(`🤖 Eva decidió usar: ${response.tool_calls.map((tc) => tc.name).join(", ")}`);
    }
    else {
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
                toolCalls: response?.tool_calls?.map((tc) => ({ name: tc.name, args: tc.args })) || [],
                respondedDirectly: !response?.tool_calls?.length,
                responsePreview: !response?.tool_calls?.length ? response.content?.substring(0, 300) : undefined,
            },
        });
    }
    if (!response || typeof response !== "object" || !("content" in response)) {
        return {
            messages: [new AIMessage("Lo siento, no se pudo obtener una respuesta válida del modelo.")],
        };
    }
    const modelReturn = {
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
//# sourceMappingURL=model.js.map