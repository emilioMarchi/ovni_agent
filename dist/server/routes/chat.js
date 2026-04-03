import { Router } from "express";
import { randomUUID } from "node:crypto";
import { graph } from "../../graph/index.js";
import admin from "../firebase.js";
import { speechToText } from "../../services/speechToTextService.js";
import { createRateLimitMiddleware, isWidgetTokenProtectionEnabled, issueWidgetToken, resolveClientId, widgetAccessGuard } from "../middleware/widgetSecurity.js";
import { tokenOrFallback } from "../middleware/tokenAuth.js";
const router = Router();
const authGuard = tokenOrFallback(widgetAccessGuard);
const db = admin.firestore();
const widgetReadRateLimit = createRateLimitMiddleware({
    windowMs: Number(process.env.WIDGET_RATE_LIMIT_READ_WINDOW_MS || 60_000),
    max: Number(process.env.WIDGET_RATE_LIMIT_READ_MAX || 120),
    keyPrefix: "widget-read",
});
const widgetWriteRateLimit = createRateLimitMiddleware({
    windowMs: Number(process.env.WIDGET_RATE_LIMIT_WRITE_WINDOW_MS || 60_000),
    max: Number(process.env.WIDGET_RATE_LIMIT_WRITE_MAX || 30),
    keyPrefix: "widget-write",
});
const SIMPLE_INPUT_REGEX = /^(hola+|hola hola|hola como|hola cómo|buenas|buen día|buen dia|buenos dias|buenos días|buenas tardes|buenas noches|gracias|muchas gracias|ok|oka+y?|dale|genial|perfecto|sí|si|no|aja|ajá|mm+|mmm+|hello|hi|ey|hey|que tal|qué tal)$/i;
function isSimpleInputWithoutIntent(text) {
    if (!text)
        return false;
    const normalized = text
        .toLowerCase()
        .replace(/[¿?¡!.,;:]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    if (!normalized)
        return false;
    if (SIMPLE_INPUT_REGEX.test(normalized))
        return true;
    if (normalized.length <= 12 && !/(precio|plan|servicio|producto|agendar|agenda|reunion|reunión|turno|presupuesto|comprar|contratar|ayuda|soporte|error|problema)/i.test(normalized)) {
        return true;
    }
    return false;
}
router.post("/widget-token", widgetReadRateLimit, widgetAccessGuard, async (req, res) => {
    try {
        const { agentId, clientId: bodyClientId } = req.body;
        const clientId = res.locals.resolvedClientId || bodyClientId || "";
        const originHost = res.locals.originHost || "";
        if (!agentId || !clientId) {
            return res.status(400).json({ success: false, error: "agentId y clientId son requeridos para emitir el token del widget" });
        }
        const issuedToken = originHost
            ? issueWidgetToken({ agentId, clientId, originHost })
            : null;
        res.json({
            success: true,
            data: {
                token: issuedToken?.token || null,
                expiresAt: issuedToken?.expiresAt || null,
                required: isWidgetTokenProtectionEnabled(),
            },
        });
    }
    catch (error) {
        console.error("Error issuing widget token:", error);
        res.status(500).json({ success: false, error: "Error al emitir token del widget" });
    }
});
router.post("/invoke", widgetWriteRateLimit, authGuard, async (req, res) => {
    try {
        const { agentId, message, audio, audioMimeType, outputAudio, threadId, clientId: bodyClientId, endSession, debug } = req.body;
        if (!agentId || (!message && !audio)) {
            return res.status(400).json({
                success: false,
                error: "agentId y message o audio son requeridos"
            });
        }
        let clientId = res.locals.resolvedClientId || bodyClientId || "";
        if (!clientId && agentId) {
            try {
                clientId = await resolveClientId(agentId, bodyClientId);
            }
            catch (e) {
                console.error("Error getting agent clientId:", e);
            }
        }
        // Generar un único threadId para que config y state usen el mismo valor
        const resolvedThreadId = threadId || randomUUID();
        const config = {
            configurable: {
                thread_id: resolvedThreadId,
                agentId,
                clientId: clientId || "unknown",
            },
        };
        const inputState = {
            messages: message ? [{ role: "user", content: message }] : [],
            agentId,
            clientId: clientId || "unknown",
            threadId: resolvedThreadId,
            endSession: endSession || false,
            outputAudio: !!(audio || outputAudio),
            ragContext: "",
            contextHistory: [],
            contextQuery: message || "",
            fastPath: isSimpleInputWithoutIntent(message),
            debugMode: !!debug,
        };
        if (audio) {
            const audioBuffer = Buffer.from(audio, "base64");
            console.log(`🎙️ [ROUTE] Audio recibido: ${audioBuffer.byteLength} bytes, mimeType: ${audioMimeType || 'no especificado'}`);
            // STT en el route para poder manejar errores antes de invocar el grafo
            const transcript = await speechToText(audioBuffer, audioMimeType).catch((e) => {
                console.error("🎙️ [ROUTE] Error STT completo:", e);
                return "";
            });
            console.log(`🎙️ [ROUTE] Transcripción: "${transcript}"`);
            if (!transcript.trim()) {
                return res.json({
                    success: true,
                    data: {
                        response: "No pude escuchar bien el audio. ¿Podés repetirlo?",
                        threadId: resolvedThreadId,
                    },
                });
            }
            inputState.messages = [{ role: "user", content: transcript }];
            inputState.audioBuffer = null; // Limpiar para no restaurar del checkpoint
            inputState.contextQuery = transcript;
            inputState.fastPath = isSimpleInputWithoutIntent(transcript);
        }
        console.log(`📨 Invocando agente ${agentId} para cliente ${clientId}${endSession ? ' (FIN DE SESIÓN)' : ''}`);
        const result = await graph.invoke(inputState, config);
        const lastMessage = result.messages[result.messages.length - 1];
        const responseData = {
            agentId,
            response: lastMessage.content,
            threadId: config.configurable.thread_id,
        };
        if (result.audioBuffer) {
            responseData.audioBase64 = result.audioBuffer.toString("base64");
        }
        if (debug && result.debugTrace) {
            responseData._debug = result.debugTrace;
        }
        res.json({ success: true, data: responseData });
    }
    catch (error) {
        console.error("Error invoking agent:", error);
        res.status(500).json({ success: false, error: "Error al invocar agente" });
    }
});
router.post("/stream", widgetWriteRateLimit, authGuard, async (req, res) => {
    try {
        const { agentId, message, threadId, clientId: bodyClientId } = req.body;
        if (!agentId || !message) {
            return res.status(400).json({
                success: false,
                error: "agentId y message son requeridos"
            });
        }
        let clientId = res.locals.resolvedClientId || bodyClientId || "";
        if (!clientId && agentId) {
            try {
                clientId = await resolveClientId(agentId, bodyClientId);
            }
            catch (e) {
                console.error("Error getting agent clientId:", e);
            }
        }
        const config = {
            configurable: {
                thread_id: threadId || randomUUID(),
                agentId,
                clientId: clientId || "unknown",
            },
        };
        const inputState = {
            messages: [{ role: "user", content: message }],
            agentId,
            clientId: clientId || "unknown",
            threadId: threadId || randomUUID(),
            ragContext: "",
            contextHistory: [],
            contextQuery: message,
            fastPath: isSimpleInputWithoutIntent(message),
        };
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        let fullResponse = "";
        for await (const chunk of await graph.stream(inputState, config)) {
            if (chunk.agent?.messages) {
                const lastMsg = chunk.agent.messages[chunk.agent.messages.length - 1];
                if (lastMsg.content) {
                    fullResponse += lastMsg.content;
                    res.write(`data: ${JSON.stringify({ type: "chunk", content: lastMsg.content })}\n\n`);
                }
            }
        }
        res.write(`data: ${JSON.stringify({ type: "done", content: fullResponse })}\n\n`);
        res.end();
    }
    catch (error) {
        console.error("Error streaming from agent:", error);
        res.status(500).json({ success: false, error: "Error al hacer stream del agente" });
    }
});
// Endpoint para marcar la sesión como terminada sin invocar el modelo
router.post("/end-session", widgetWriteRateLimit, authGuard, async (req, res) => {
    try {
        const { agentId, clientId: bodyClientId, threadId } = req.body;
        if (!agentId || !threadId) {
            return res.status(400).json({ success: false, error: "agentId y threadId son requeridos" });
        }
        const clientId = res.locals.resolvedClientId || bodyClientId || "";
        // Buscar el documento de historial de esta sesión y marcarla como terminada
        const snapshot = await db
            .collection("history")
            .where("threadId", "==", threadId)
            .where("agentId", "==", agentId)
            .limit(1)
            .get();
        if (!snapshot.empty) {
            await snapshot.docs[0].ref.update({
                endedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error("Error en end-session:", error);
        res.status(500).json({ success: false, error: "Error al finalizar sesión" });
    }
});
router.get("/history/:threadId", widgetReadRateLimit, authGuard, async (req, res) => {
    try {
        const { threadId } = req.params;
        const snapshot = await db
            .collection("history")
            .where("threadId", "==", threadId)
            .limit(1)
            .get();
        if (snapshot.empty) {
            return res.json({ success: true, data: [] });
        }
        const doc = snapshot.docs[0];
        const data = doc.data();
        const messages = data.messages || [];
        res.json({ success: true, data: messages });
    }
    catch (error) {
        console.error("Error fetching history:", error);
        res.status(500).json({ success: false, error: "Error al obtener historial" });
    }
});
router.get("/sessions", async (req, res) => {
    try {
        const { clientId, agentId, limit = "20" } = req.query;
        if (!clientId) {
            return res.status(400).json({ success: false, error: "clientId es requerido" });
        }
        let snapshot;
        if (agentId) {
            snapshot = await db.collection("history")
                .where("clientId", "==", clientId)
                .where("agentId", "==", agentId)
                .limit(parseInt(limit))
                .get();
        }
        else {
            snapshot = await db.collection("history")
                .where("clientId", "==", clientId)
                .limit(parseInt(limit))
                .get();
        }
        const sessions = await Promise.all(snapshot.docs.map(async (doc) => {
            const data = doc.data();
            let userName = data.userName || null;
            if (!userName && data.userId && data.userId !== 'anonymous') {
                try {
                    const userDoc = await db.collection("users").doc(`${data.clientId}_${data.userId}`).get();
                    if (userDoc.exists) {
                        userName = userDoc.data()?.name || null;
                    }
                }
                catch (e) {
                    console.log('Error fetching user name:', e);
                }
            }
            const displayName = userName || (data.threadId ? `Usuario-${data.threadId.slice(0, 8)}` : 'Anónimo');
            return {
                threadId: data.threadId,
                agentId: data.agentId,
                userId: data.userId,
                userName: displayName,
                lastUpdate: data.lastUpdate?.toDate?.() ? data.lastUpdate.toDate().toISOString() : null,
                messageCount: data.messages?.length || 0,
                summary: data.summary,
                classification: data.classification,
            };
        }));
        sessions.sort((a, b) => {
            const dateA = a.lastUpdate ? new Date(a.lastUpdate).getTime() : 0;
            const dateB = b.lastUpdate ? new Date(b.lastUpdate).getTime() : 0;
            return dateB - dateA;
        });
        res.json({ success: true, data: sessions });
    }
    catch (error) {
        console.error("Error fetching sessions:", error?.message || error);
        res.status(500).json({ success: false, error: "Error al obtener sesiones: " + (error?.message || error) });
    }
});
router.get("/sessions/:threadId", async (req, res) => {
    try {
        const { threadId } = req.params;
        const snapshot = await db
            .collection("history")
            .where("threadId", "==", threadId)
            .limit(1)
            .get();
        if (snapshot.empty) {
            return res.status(404).json({ success: false, error: "Sesión no encontrada" });
        }
        const doc = snapshot.docs[0];
        const data = doc.data();
        res.json({
            success: true,
            data: {
                threadId: data.threadId,
                clientId: data.clientId,
                agentId: data.agentId,
                userId: data.userId,
                userName: data.userName || null,
                messages: data.messages,
                summary: data.summary,
                classification: data.classification,
                lastUpdate: data.lastUpdate?.toDate?.() ? data.lastUpdate.toDate().toISOString() : null,
            }
        });
    }
    catch (error) {
        console.error("Error fetching session:", error);
        res.status(500).json({ success: false, error: "Error al obtener sesión" });
    }
});
router.get("/agents", widgetReadRateLimit, authGuard, async (req, res) => {
    try {
        const clientId = res.locals.resolvedClientId || req.query.clientId;
        if (!clientId) {
            return res.status(400).json({ success: false, error: "clientId es requerido" });
        }
        const snapshot = await db
            .collection("agents")
            .where("clientId", "==", clientId)
            .where("active", "==", true)
            .get();
        const agents = snapshot.docs.map((doc) => ({
            id: doc.id,
            name: doc.data().name,
            description: doc.data().description,
            welcomeMessage: doc.data().welcomeMessage,
        }));
        res.json({ success: true, data: agents });
    }
    catch (error) {
        console.error("Error fetching agents:", error);
        res.status(500).json({ success: false, error: "Error al obtener agentes" });
    }
});
export default router;
//# sourceMappingURL=chat.js.map