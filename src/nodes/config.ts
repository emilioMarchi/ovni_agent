import admin from "firebase-admin";
import { AgentStateType } from "../state/state.js";
import { RunnableConfig } from "@langchain/core/runnables";

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
    const agentDoc = await db.collection("agents").doc(agentId).get();

    if (!agentDoc.exists) {
      console.warn(`⚠️ Agente ${agentId} no encontrado en Firestore.`);
      return {
        systemInstruction: "Sos un asistente genérico porque no encontré tu configuración.",
      };
    }

    const agentData = agentDoc.data()!;
    
    console.log("🔧 [CONFIG] Datos cargados de Firestore:", {
      clientId: agentData.clientId,
      skills: agentData.skills,
      functions: agentData.functions,
      knowledgeDocs: agentData.knowledgeDocs?.length || 0,
    });

    // Devolvemos las actualizaciones al estado
    return {
      clientId: agentData.clientId || clientId || "",
      businessContext: agentData.businessContext || "",
      systemInstruction: agentData.systemInstruction || "",
      allowedDocIds: agentData.knowledgeDocs || [],
      skills: agentData.skills || [],
      functions: agentData.functions || [],
      threadId,
    };

  } catch (error) {
    console.error("❌ Error en configNode:", error);
    return {};
  }
}
