import { Router } from "express";
import admin from "../firebase.js";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";
import path from "path";
import fs from "fs";
import { Pinecone } from "@pinecone-database/pinecone";
import { masterAuth } from "../middleware/auth.js";
import { tokenOrFallback } from "../middleware/tokenAuth.js";
import { processAndIngestDocument } from "../../utils/documentIngestor.js";
const router = Router();
const db = admin.firestore();
// Map de procesos activos para poder cancelarlos
const activeProcesses = new Map();
const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx", ".txt", ".md", ".json", ".xlsx", ".xls", ".csv"];
function createProcessingLog(message) {
    return {
        at: new Date().toISOString(),
        message,
    };
}
async function updateDocumentProcessing(docId, data, logMessage) {
    const payload = {
        ...data,
        updatedAt: new Date().toISOString(),
    };
    if (logMessage) {
        payload.processingLogs = admin.firestore.FieldValue.arrayUnion(createProcessingLog(logMessage));
    }
    await db.collection("knowledge_docs").doc(docId).set(payload, { merge: true });
}
const upload = multer({
    dest: "uploads/",
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ALLOWED_EXTENSIONS.includes(ext)) {
            cb(null, true);
        }
        else {
            cb(new Error(`Formato no soportado: ${ext}. Soportados: ${ALLOWED_EXTENSIONS.join(", ")}`));
        }
    },
});
router.use(tokenOrFallback(masterAuth));
// Listar documentos de un cliente
router.get("/", async (req, res) => {
    try {
        const { clientId } = req.query;
        if (!clientId) {
            return res.status(400).json({ success: false, error: "clientId es requerido" });
        }
        const snapshot = await db.collection("knowledge_docs")
            .where("clientId", "==", clientId)
            .get();
        const docs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })).sort((a, b) => {
            const dateA = new Date(a.createdAt || 0).getTime();
            const dateB = new Date(b.createdAt || 0).getTime();
            return dateB - dateA;
        });
        res.json({ success: true, data: docs });
    }
    catch (error) {
        console.error("Error fetching documents:", error);
        res.status(500).json({ success: false, error: `Error al obtener documentos: ${error.message}` });
    }
});
router.get("/:id/status", async (req, res) => {
    try {
        const docSnap = await db.collection("knowledge_docs").doc(req.params.id).get();
        if (!docSnap.exists) {
            return res.status(404).json({ success: false, error: "Documento no encontrado" });
        }
        res.json({ success: true, data: { id: docSnap.id, ...docSnap.data() } });
    }
    catch (error) {
        console.error("Error fetching document status:", error);
        res.status(500).json({ success: false, error: `Error al obtener estado del documento: ${error.message}` });
    }
});
// Upload y procesar documento
router.post("/upload", upload.single("file"), async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ success: false, error: "No se envió archivo" });
        }
        const clientId = req.body.clientId;
        if (!clientId) {
            return res.status(400).json({ success: false, error: "clientId es requerido" });
        }
        const filename = file.originalname;
        const description = req.body.description || "";
        const docType = req.body.docType === "contract" ? "contract" : "reference";
        const docId = `doc_${Date.now()}`;
        const tempPath = file.path;
        const now = new Date().toISOString();
        await db.collection("knowledge_docs").doc(docId).set({
            clientId,
            filename,
            description,
            docType,
            keywords: [],
            createdAt: now,
            updatedAt: now,
            status: "processing",
            processingStage: "upload_complete",
            processingProgress: 5,
            processingLogs: [createProcessingLog(`Archivo recibido: ${filename}`)],
            error: null,
            partsCount: 0,
        }, { merge: true });
        res.status(202).json({
            success: true,
            data: {
                id: docId,
                filename,
                status: "processing",
                processingStage: "upload_complete",
                processingProgress: 5,
            },
        });
        void (async () => {
            const abortController = new AbortController();
            activeProcesses.set(docId, abortController);
            try {
                const result = await processAndIngestDocument({
                    filePath: tempPath,
                    clientId,
                    docId,
                    filename,
                    description,
                    docType,
                    signal: abortController.signal,
                    onProgress: async (progressUpdate) => {
                        await updateDocumentProcessing(docId, {
                            status: "processing",
                            processingStage: progressUpdate.stage,
                            processingProgress: progressUpdate.progress,
                        }, progressUpdate.message);
                    },
                });
                await updateDocumentProcessing(docId, {
                    status: "ready",
                    processingStage: "completed",
                    processingProgress: 100,
                    partsCount: result.partsCount,
                    error: null,
                }, `Documento listo: ${result.partsCount} fragmentos indexados`);
            }
            catch (error) {
                if (error.message === "CANCELLED") {
                    console.log(`🚫 Procesamiento cancelado: ${filename} (${docId})`);
                    // No actualizar — el endpoint cancel ya lo maneja
                }
                else {
                    console.error("Error uploading document:", error);
                    await updateDocumentProcessing(docId, {
                        status: "error",
                        processingStage: "failed",
                        processingProgress: 100,
                        error: error.message || "Error desconocido procesando documento",
                    }, `Error procesando documento: ${error.message || "Error desconocido"}`);
                }
            }
            finally {
                activeProcesses.delete(docId);
                try {
                    fs.unlinkSync(tempPath);
                }
                catch { }
            }
        })();
    }
    catch (error) {
        console.error("Error uploading document:", error);
        res.status(500).json({ success: false, error: `Error al procesar documento: ${error.message}` });
    }
});
// Crear referencia de documento (sin archivo)
router.post("/", async (req, res) => {
    try {
        const { clientId, filename, description, keywords } = req.body;
        if (!clientId || !filename) {
            return res.status(400).json({ success: false, error: "clientId y filename son requeridos" });
        }
        const docId = `doc_${uuidv4().replace(/-/g, "").slice(0, 24)}`;
        const now = new Date().toISOString();
        const docData = {
            clientId,
            filename,
            description: description || "",
            keywords: keywords || [],
            createdAt: now,
            updatedAt: now,
            status: "pending" // Para el futuro procesamiento
        };
        await db.collection("knowledge_docs").doc(docId).set(docData);
        res.status(201).json({ success: true, data: { id: docId, ...docData } });
    }
    catch (error) {
        console.error("Error creating document:", error);
        res.status(500).json({ success: false, error: "Error al crear documento" });
    }
});
// Cancelar procesamiento de documento
router.post("/:id/cancel", async (req, res) => {
    try {
        const { id } = req.params;
        // Abortar el proceso si está activo
        const controller = activeProcesses.get(id);
        if (controller) {
            controller.abort();
            activeProcesses.delete(id);
        }
        // Marcar como cancelado en Firestore
        const docRef = db.collection("knowledge_docs").doc(id);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
            return res.status(404).json({ success: false, error: "Documento no encontrado" });
        }
        const docData = docSnap.data();
        const clientId = docData.clientId;
        // Limpiar partes parciales en Firestore
        const partsSnap = await db.collection("knowledge_parts").where("docId", "==", id).get();
        if (partsSnap.size > 0) {
            const batch = db.batch();
            partsSnap.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }
        // Limpiar vectores parciales en Pinecone
        try {
            if (process.env.PINECONE_API_KEY) {
                const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
                const index = pinecone.index("chatbot-knowledge");
                const partIds = partsSnap.docs.map(d => d.id);
                if (partIds.length > 0) {
                    await index.namespace(`client_${clientId}`).deleteMany(partIds);
                }
                await index.namespace("document_catalog").deleteMany([id]);
            }
        }
        catch (e) {
            console.error("⚠️ Error limpiando Pinecone en cancel:", e);
        }
        // Eliminar el doc de Firestore
        await docRef.delete();
        console.log(`🚫 Documento cancelado y limpiado: ${id} (${partsSnap.size} partes eliminadas)`);
        res.json({ success: true, message: "Procesamiento cancelado y datos limpiados" });
    }
    catch (error) {
        console.error("Error cancelling document:", error);
        res.status(500).json({ success: false, error: `Error al cancelar: ${error.message}` });
    }
});
// Eliminar documento con cascade (parts + Pinecone)
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        // Obtener el doc para saber clientId
        const docRef = db.collection("knowledge_docs").doc(id);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
            return res.status(404).json({ success: false, error: "Documento no encontrado" });
        }
        const docData = docSnap.data();
        const clientId = docData.clientId;
        const batch = db.batch();
        // 1. Eliminar knowledge_parts asociadas
        const partsSnap = await db.collection("knowledge_parts").where("docId", "==", id).get();
        partsSnap.docs.forEach(doc => batch.delete(doc.ref));
        // 2. Eliminar el doc
        batch.delete(docRef);
        await batch.commit();
        // 3. Limpiar Pinecone: vectores del doc en client namespace y document_catalog
        try {
            if (process.env.PINECONE_API_KEY) {
                const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
                const index = pinecone.index("chatbot-knowledge");
                // Borrar del namespace del cliente por IDs de partes
                const partIds = partsSnap.docs.map(d => d.id);
                if (partIds.length > 0) {
                    await index.namespace(`client_${clientId}`).deleteMany(partIds);
                }
                // Borrar del document_catalog
                await index.namespace("document_catalog").deleteMany([id]);
            }
        }
        catch (pineconeErr) {
            console.error("⚠️ Error limpiando Pinecone (doc eliminado de Firestore):", pineconeErr);
        }
        console.log(`🗑️ Documento ${id} eliminado (${partsSnap.size} partes + vectores Pinecone)`);
        res.json({ success: true, message: "Documento, fragmentos y vectores eliminados" });
    }
    catch (error) {
        console.error("Error deleting document:", error);
        res.status(500).json({ success: false, error: "Error al eliminar documento" });
    }
});
export default router;
//# sourceMappingURL=documents.js.map