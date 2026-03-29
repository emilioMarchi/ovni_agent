import admin from "firebase-admin";
const AGENT_CONFIG_CACHE_TTL_MS = 5 * 60 * 1000;
const agentConfigCache = new Map();
/**
 * Nodo de Configuración: Hidrata el estado inicial con la información del agente
 * desde Firestore (skills, knowledgeDocs, instructions).
 */
export async function configNode(state, _, config) {
    const { agentId, clientId, systemInstruction } = state;
    const threadId = config?.configurable?.thread_id || state.threadId || "";
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
        const agentData = agentDoc.data();
        const resolvedClientId = agentData.clientId || clientId || "";
        const adminDoc = resolvedClientId
            ? await db.collection("admins").doc(resolvedClientId).get()
            : null;
        const adminData = adminDoc?.exists ? adminDoc.data() : null;
        const organizationName = adminData?.businessName || adminData?.name || "";
        const mergedBusinessContext = [adminData?.businessContext, agentData.businessContext]
            .filter((value) => typeof value === "string" && value.trim().length > 0)
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
        });
        // Devolvemos las actualizaciones al estado
        const hydratedConfig = {
            clientId: resolvedClientId,
            agentName: agentData.name || "",
            agentDescription: agentData.description || "",
            organizationName,
            businessContext: mergedBusinessContext,
            systemInstruction: effectiveSystemInstruction,
            allowedDocIds: agentData.knowledgeDocs || [],
            skills: agentData.skills || [],
            functions: agentData.functions || [],
        };
        agentConfigCache.set(agentId, {
            value: hydratedConfig,
            expiresAt: Date.now() + AGENT_CONFIG_CACHE_TTL_MS,
        });
        return {
            ...hydratedConfig,
            threadId,
        };
    }
    catch (error) {
        console.error("❌ Error en configNode:", error);
        return {};
    }
}
//# sourceMappingURL=config.js.map