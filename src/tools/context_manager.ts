import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

interface ConversationContext {
  userInfo: {
    name?: string;
    email?: string;
    phone?: string;
  };
  businessInfo: {
    rubric?: string;
    localidad?: string;
    proyecto?: string;
  };
}

const sessionContext: Map<string, ConversationContext> = new Map();

export function getSessionData(threadId: string): ConversationContext {
  if (!sessionContext.has(threadId)) {
    sessionContext.set(threadId, {
      userInfo: {},
      businessInfo: {},
    });
  }
  return sessionContext.get(threadId)!;
}

export const contextManagerTool = new DynamicStructuredTool({
  name: "context_manager",
  description: `Gestiona el contexto de la conversación. 
- "save_user": guarda datos del usuario (nombre, email, teléfono)
- "save_business": guarda info del negocio (rubro, localidad, proyecto)
- "get": consulta un dato específico
- "get_summary": resume todo lo que sabés del usuario y la conversación`,
  schema: z.object({
    action: z.enum(["save_user", "save_business", "get", "get_summary"]).describe("Acción a realizar"),
    threadId: z.string().describe("ID de la sesión/hilo de conversación"),
    userData: z.object({
      name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
    }).optional(),
    businessData: z.object({
      rubric: z.string().optional(),
      localidad: z.string().optional(),
      proyecto: z.string().optional(),
    }).optional(),
    field: z.string().optional(),
  }),
  func: async ({ action, threadId, userData, businessData, field }) => {
    const ctx = getSessionData(threadId);

    if (action === "save_user" && userData) {
      ctx.userInfo = { ...ctx.userInfo, ...userData };
      console.log(`📝 [CONTEXT] Usuario guardado para ${threadId}:`, ctx.userInfo);
      return `Datos de usuario guardados: ${JSON.stringify(ctx.userInfo)}`;
    }

    if (action === "save_business" && businessData) {
      ctx.businessInfo = { ...ctx.businessInfo, ...businessData };
      console.log(`📝 [CONTEXT] Negocio guardado para ${threadId}:`, ctx.businessInfo);
      return `Datos del negocio guardados: ${JSON.stringify(ctx.businessInfo)}`;
    }

    if (action === "get") {
      console.log(`📝 [CONTEXT] Consulta ${field || "todos"} para ${threadId}`);
      if (field === "user") return JSON.stringify(ctx.userInfo);
      if (field === "business") return JSON.stringify(ctx.businessInfo);
      return JSON.stringify({ user: ctx.userInfo, business: ctx.businessInfo });
    }

    if (action === "get_summary") {
      console.log(`📝 [CONTEXT] Resumen solicitado para ${threadId}`);
      return `
USUARIO:
- Nombre: ${ctx.userInfo.name || "No proporcionado"}
- Email: ${ctx.userInfo.email || "No proporcionado"}
- Teléfono: ${ctx.userInfo.phone || "No proporcionado"}

NEGOCIO:
- Rubro: ${ctx.businessInfo.rubric || "No proporcionado"}
- Localidad: ${ctx.businessInfo.localidad || "No proporcionado"}
- Proyecto: ${ctx.businessInfo.proyecto || "No proporcionado"}
      `.trim();
    }

    return "Acción no reconocida";
  },
});

export function clearSessionContext(threadId: string) {
  sessionContext.delete(threadId);
  console.log(`🗑️ [CONTEXT] Contexto borrado para ${threadId}`);
}
