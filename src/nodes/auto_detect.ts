import { AgentStateType } from "../state/state.js";
import { availabilityCheckerTool, appointmentManagerTool, productCatalogTool, knowledgeRetrieverTool } from "../tools/index.js";

const TOOL_BY_KEYWORD: Record<string, { tool: any; action?: string; field?: string }> = {
  // Eliminamos 'agendar', 'reunion', 'cita' para dejar que el modelo decida usar appointment_manager
  producto: { tool: productCatalogTool, field: "query" },
  catalogo: { tool: productCatalogTool, field: "listAll" },
  tienda: { tool: productCatalogTool, field: "query" },
  precio: { tool: productCatalogTool, field: "query" },
  precios: { tool: productCatalogTool, field: "query" },
  servicio: { tool: knowledgeRetrieverTool, field: "query" },
  info: { tool: knowledgeRetrieverTool, field: "query" },
  informacion: { tool: knowledgeRetrieverTool, field: "query" },
};

export async function autoDetectAndInvoke(state: AgentStateType) {
  const { messages, clientId, threadId } = state;
  
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage) return {};
  
  const userMessage = typeof lastMessage.content === "string" 
    ? lastMessage.content.toLowerCase() 
    : "";
  
  // Buscar coincidencia de palabras clave
  let matchedTool: any = null;
  let matchedAction: string | undefined;
  let matchedField: string | undefined;
  let matchedKeyword = "";
  
  for (const [keyword, config] of Object.entries(TOOL_BY_KEYWORD)) {
    if (userMessage.includes(keyword)) {
      matchedTool = config.tool;
      matchedAction = config.action;
      matchedField = config.field;
      matchedKeyword = keyword;
      break;
    }
  }
  
  if (!matchedTool) {
    console.log("🔍 [AUTO-DETECT] No se detectó ninguna intención");
    return {};
  }
  
  console.log(`🔍 [AUTO-DETECT] Detectado: "${matchedKeyword}" → ${matchedTool.name}`);
  
  try {
    let result = "";
    
    if (matchedTool.name === "appointment_manager") {
      const params = { 
        action: matchedAction || "check_availability", 
        clientId,
        date: ""
      };
      result = await matchedTool.invoke(params);
    } 
    else if (matchedTool.name === "availability_checker") {
      const params = { 
        action: matchedAction || "check_next_days", 
        clientId,
        daysAhead: 5
      };
      result = await matchedTool.invoke(params);
    }
    else if (matchedTool.name === "product_catalog") {
      const params: any = { clientId };
      if (matchedField === "listAll") {
        params.listAll = true;
      } else {
        params.query = userMessage.replace(/[^a-zA-ZáéíóúñÑ\s]/g, "").trim();
      }
      result = await matchedTool.invoke(params);
    }
    else if (matchedTool.name === "knowledge_retriever") {
      const params = { 
        query: userMessage.replace(/[^a-zA-ZáéíóúñÑ\s]/g, "").trim(), 
        clientId,
        allowedDocIds: []
      };
      result = await matchedTool.invoke(params);
    }
    
    console.log(`🔍 [AUTO-DETECT] Resultado: ${result.substring(0, 100)}...`);
    
    return {
      ragContext: result
    };
    
  } catch (error: any) {
    console.error(`🔍 [AUTO-DETECT] Error:`, error.message);
    return {};
  }
}
