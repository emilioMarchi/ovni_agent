import admin from "firebase-admin";
import { AgentStateType } from "../state/state.js";
import { RunnableConfig } from "@langchain/core/runnables";
import { resolveAllowedDocIds } from "../utils/folderScopeResolver.js";
import { setActiveThread, pushDebugEvent } from "../utils/debugCollector.js";

const AGENT_CONFIG_CACHE_TTL_MS = 5 * 60 * 1000;
const agentConfigCache = new Map<string, { value: Record<string, unknown>; expiresAt: number }>();

/**
 * Invalida el cache de configuración de un agente.
 * Llamar cuando se actualice el agente desde la API.
 */
export function invalidateAgentConfigCache(agentId: string) {
  agentConfigCache.delete(agentId);
}

export function invalidateAllAgentConfigCache() {
  agentConfigCache.clear();
}

/**
 * Nodo de Configuración: Hidrata el estado inicial con la información del agente
 * desde Firestore (skills, knowledgeDocs, instructions).
 */
export async function configNode(state: AgentStateType, _: any, config?: RunnableConfig) {
  const { agentId, clientId, systemInstruction } = state;
  const threadId = (config?.configurable as any)?.thread_id || state.threadId || "";

  // Validar que exista agentId
  if (!agentId) {
    console.warn("⚠️ No se proporcionó agentId en el estado.");
    return {
      systemInstruction: "Error: No se proporcionó ID de agente.",
    };
  }

  // Si ya tenemos instrucciones, asumimos que ya está configurado (para ahorrar lectura)
  if (systemInstruction && systemInstruction.length > 0) {
    return {};
  }

  try {
    const db = admin.firestore();
    const cached = agentConfigCache.get(agentId);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        ...cached.value,
        threadId,
      };
    }

    const agentDoc = await db.collection("agents").doc(agentId).get();

    if (!agentDoc.exists) {
      console.warn(`⚠️ Agente ${agentId} no encontrado en Firestore.`);
      return {
        systemInstruction: "Sos un asistente genérico porque no encontré tu configuración.",
      };
    }

    const agentData = agentDoc.data()!;
    const resolvedClientId = agentData.clientId || clientId || "";
    const adminDoc = resolvedClientId
      ? await db.collection("admins").doc(resolvedClientId).get()
      : null;
    const adminData = adminDoc?.exists ? adminDoc.data() : null;
    const organizationName = adminData?.businessName || adminData?.name || "";
    const mergedBusinessContext = [adminData?.businessContext, agentData.businessContext]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join("\n\n");
    const effectiveSystemInstruction = agentData.systemInstruction || adminData?.systemInstruction || "";
    
    console.log("🔧 [CONFIG] Datos cargados de Firestore:", {
      name: agentData.name,
      clientId: resolvedClientId,
      organizationName,
      hasAdminInstruction: !!adminData?.systemInstruction,
      hasAdminBusinessContext: !!adminData?.businessContext,
      skills: agentData.skills,
      functions: agentData.functions,
      knowledgeDocs: agentData.knowledgeDocs?.length || 0,
      knowledgeFolderIds: agentData.knowledgeFolderIds?.length || 0,
    });

    // Resolver scope: carpetas + docs sueltos → lista plana de docIds
    const resolvedDocIds = await resolveAllowedDocIds({
      clientId: resolvedClientId,
      knowledgeDocs: agentData.knowledgeDocs || [],
      knowledgeFolderIds: agentData.knowledgeFolderIds || [],
      includeSubfolders: agentData.includeSubfolders !== false,
    });

    console.log(`🔧 [CONFIG] Scope resuelto: ${resolvedDocIds.length} docs (${agentData.knowledgeDocs?.length || 0} sueltos + ${agentData.knowledgeFolderIds?.length || 0} carpetas)`);

    // Activate debug thread if needed
    if (state.debugMode) {
      setActiveThread(threadId);
      pushDebugEvent({
        node: "config",
        timestamp: new Date().toISOString(),
        type: "agent_loaded",
        data: {
          agentId,
          agentName: agentData.name || "",
          clientId: resolvedClientId,
          organizationName,
          skills: agentData.skills || [],
          functions: agentData.functions || [],
          knowledgeDocs: agentData.knowledgeDocs?.length || 0,
          knowledgeFolderIds: agentData.knowledgeFolderIds?.length || 0,
          resolvedDocIds: resolvedDocIds.length,
          allowedDocIds: resolvedDocIds,
        },
      });
    }

    // Devolvemos las actualizaciones al estado
    const hydratedConfig: Record<string, unknown> = {
      clientId: resolvedClientId,
      agentName: agentData.name || "",
      agentDescription: agentData.description || "",
      organizationName,
      businessContext: mergedBusinessContext,
      systemInstruction: effectiveSystemInstruction,
      allowedDocIds: resolvedDocIds,
      skills: agentData.skills || [],
      functions: agentData.functions || [],
    };

    // Include config debug event in the state trace
    if (state.debugMode) {
      const { drainDebugEvents } = await import("../utils/debugCollector.js");
      hydratedConfig.debugTrace = drainDebugEvents();
    }

    agentConfigCache.set(agentId, {
      value: hydratedConfig,
      expiresAt: Date.now() + AGENT_CONFIG_CACHE_TTL_MS,
    });

    return {
      ...hydratedConfig,
      threadId,
    };

  } catch (error) {
    console.error("❌ Error en configNode:", error);
    return {};
  }
}
