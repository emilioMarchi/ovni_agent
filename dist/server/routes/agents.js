import { Router } from "express";
import admin from "../firebase.js";
import { v4 as uuidv4 } from "uuid";
import { masterAuth } from "../middleware/auth.js";
import { tokenOrFallback } from "../middleware/tokenAuth.js";
import { invalidateAgentConfigCache } from "../../nodes/config.js";
const router = Router();
const db = admin.firestore();
// Protegido: requiere auth
router.get("/", tokenOrFallback(masterAuth), async (req, res) => {
    try {
        const { clientId } = req.query;
        let query = db.collection("agents");
        if (clientId) {
            query = query.where("clientId", "==", clientId);
        }
        const snapshot = await query.get();
        const agents = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));
        res.json({ success: true, data: agents });
    }
    catch (error) {
        console.error("Error fetching agents:", error);
        res.status(500).json({ success: false, error: "Error al obtener agentes" });
    }
});
// GET /api/agents/:id
// Si viene ?demo=true, permite acceso público (sin header x-client-id ni token)
router.get("/:id", async (req, res, next) => {
    const isDemo = req.query.demo === "true" || req.query.demo === "1";
    if (isDemo) {
        // Demo mode: acceso público
        try {
            const doc = await db.collection("agents").doc(req.params.id).get();
            if (!doc.exists) {
                return res.status(404).json({ success: false, error: "Agente no encontrado" });
            }
            return res.json({ success: true, data: { id: doc.id, ...doc.data() } });
        }
        catch (error) {
            console.error("Error fetching agent:", error);
            return res.status(500).json({ success: false, error: "Error al obtener agente" });
        }
    }
    // Si no es demo, usar tokenOrFallback(masterAuth)
    return tokenOrFallback(masterAuth)(req, res, async () => {
        try {
            const doc = await db.collection("agents").doc(req.params.id).get();
            if (!doc.exists) {
                return res.status(404).json({ success: false, error: "Agente no encontrado" });
            }
            res.json({ success: true, data: { id: doc.id, ...doc.data() } });
        }
        catch (error) {
            console.error("Error fetching agent:", error);
            res.status(500).json({ success: false, error: "Error al obtener agente" });
        }
    });
});
// Protegido: requiere auth
router.post("/", tokenOrFallback(masterAuth), async (req, res) => {
    try {
        const { clientId, name, description, systemInstruction, businessContext, skills, functions, tools, model, temperature, maxTokens, type, profile, knowledgeDocs, knowledgeFolderIds, includeSubfolders } = req.body;
        if (!clientId || !name) {
            return res.status(400).json({ success: false, error: "clientId y name son requeridos" });
        }
        const agentId = `agent_${uuidv4().replace(/-/g, "").slice(0, 24)}`;
        const now = new Date().toISOString();
        const defaultFunctions = [
            "knowledge_retriever",
            "product_catalog",
            "user_profile_manager",
            "comms_sender",
            "appointment_manager",
            "history_retriever",
        ];
        const agentData = {
            clientId,
            name,
            description: description || "",
            systemInstruction: systemInstruction || "",
            businessContext: businessContext || "",
            skills: skills || [],
            functions: functions || defaultFunctions,
            tools: tools || [],
            model: model || "gemini-2.5-flash-lite",
            temperature: temperature ?? 0.7,
            maxTokens: maxTokens ?? 2048,
            type: type || "general",
            profile: profile || "general",
            knowledgeDocs: knowledgeDocs || [],
            knowledgeFolderIds: knowledgeFolderIds || [],
            includeSubfolders: includeSubfolders !== false,
            version: "2.0.0",
            active: true,
            createdAt: now,
            updatedAt: now,
        };
        await db.collection("agents").doc(agentId).set(agentData);
        res.status(201).json({ success: true, data: { id: agentId, ...agentData } });
    }
    catch (error) {
        console.error("Error creating agent:", error);
        res.status(500).json({ success: false, error: "Error al crear agente" });
    }
});
router.put("/:id", async (req, res) => {
    try {
        const updates = {
            updatedAt: new Date().toISOString(),
        };
        const allowedFields = [
            "name", "description", "systemInstruction", "businessContext",
            "skills", "functions", "tools", "model", "temperature",
            "maxTokens", "active", "type", "profile", "knowledgeDocs",
            "knowledgeFolderIds", "includeSubfolders"
        ];
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        }
        await db.collection("agents").doc(req.params.id).update(updates);
        invalidateAgentConfigCache(req.params.id);
        const doc = await db.collection("agents").doc(req.params.id).get();
        res.json({ success: true, data: { id: doc.id, ...doc.data() } });
    }
    catch (error) {
        console.error("Error updating agent:", error);
        res.status(500).json({ success: false, error: "Error al actualizar agente" });
    }
});
router.delete("/:id", async (req, res) => {
    try {
        const agentId = req.params.id;
        const batch = db.batch();
        // 1. Verificar que el agente existe
        const agentDoc = await db.collection("agents").doc(agentId).get();
        if (!agentDoc.exists) {
            return res.status(404).json({ success: false, error: "Agente no encontrado" });
        }
        // 2. Eliminar agent_metadata del agente
        const metadataSnap = await db.collection("agent_metadata").where("agentId", "==", agentId).get();
        metadataSnap.docs.forEach(doc => batch.delete(doc.ref));
        // 3. Eliminar usage_logs del agente
        const logsSnap = await db.collection("usage_logs").where("agentId", "==", agentId).get();
        logsSnap.docs.forEach(doc => batch.delete(doc.ref));
        // NOTA: Products pertenecen al admin (clientId), no al agente. Se eliminan en admins.ts.
        // NOTA: El historial (history + checkpoints) NO se elimina al borrar un agente.
        // Solo se elimina cuando se borra el admin/organización completa (ver admins.ts).
        // 4. Eliminar el agente
        batch.delete(db.collection("agents").doc(agentId));
        await batch.commit();
        console.log(`🗑️ Agente ${agentId} eliminado con cascade (metadata: ${metadataSnap.size}, logs: ${logsSnap.size}) — historial y products preservados`);
        res.json({ success: true, message: "Agente y datos relacionados eliminados" });
    }
    catch (error) {
        console.error("Error deleting agent:", error);
        res.status(500).json({ success: false, error: "Error al eliminar agente" });
    }
});
router.patch("/:id/functions", async (req, res) => {
    try {
        const { functions } = req.body;
        if (!Array.isArray(functions)) {
            return res.status(400).json({ success: false, error: "functions debe ser un array" });
        }
        await db.collection("agents").doc(req.params.id).update({
            functions,
            updatedAt: new Date().toISOString(),
        });
        const doc = await db.collection("agents").doc(req.params.id).get();
        res.json({ success: true, data: { id: doc.id, ...doc.data() } });
    }
    catch (error) {
        console.error("Error updating agent functions:", error);
        res.status(500).json({ success: false, error: "Error al actualizar funciones" });
    }
});
router.post("/:id/functions/:functionName/toggle", async (req, res) => {
    try {
        const { functionName } = req.params;
        const doc = await db.collection("agents").doc(req.params.id).get();
        if (!doc.exists) {
            return res.status(404).json({ success: false, error: "Agente no encontrado" });
        }
        const currentFunctions = doc.data()?.functions || [];
        let newFunctions;
        if (currentFunctions.includes(functionName)) {
            newFunctions = currentFunctions.filter((f) => f !== functionName);
        }
        else {
            newFunctions = [...currentFunctions, functionName];
        }
        await db.collection("agents").doc(req.params.id).update({
            functions: newFunctions,
            updatedAt: new Date().toISOString(),
        });
        res.json({
            success: true,
            data: {
                id: doc.id,
                functions: newFunctions,
                toggled: functionName,
                added: !currentFunctions.includes(functionName)
            }
        });
    }
    catch (error) {
        console.error("Error toggling function:", error);
        res.status(500).json({ success: false, error: "Error al alternar función" });
    }
});
export default router;
//# sourceMappingURL=agents.js.map