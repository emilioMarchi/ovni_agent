import admin from "firebase-admin";
import { AgentStateType } from "../state/state.js";

/**
 * Nodo de Configuración: Hidrata el estado inicial con la información del agente
 * desde Firestore (skills, knowledgeDocs, instructions).
 */
export async function configNode(state: AgentStateType) {
  const { agentId, clientId, systemInstruction } = state;

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
    
    // Devolvemos las actualizaciones al estado
    return {
      clientId: agentData.clientId || clientId,
      businessContext: agentData.businessContext || "",
      systemInstruction: agentData.systemInstruction || "",
      allowedDocIds: agentData.knowledgeDocs || [],
      skills: agentData.skills || [],
      functions: agentData.functions || [],
    };

  } catch (error) {
    console.error("❌ Error en configNode:", error);
    return {};
  }
}
