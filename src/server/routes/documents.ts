import { Router, Response } from "express";
import admin from "../firebase.js";
import { v4 as uuidv4 } from "uuid";
import { masterAuth, AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();
const db = admin.firestore();

router.use(masterAuth);

// Listar documentos de un cliente
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId } = req.query;
    console.log(`[DOCS] Buscando documentos para clientId: ${clientId}`);
    
    if (!clientId) {
      return res.status(400).json({ success: false, error: "clientId es requerido" });
    }

    const snapshot = await db.collection("knowledge_docs")
      .where("clientId", "==", clientId)
      .get();

    console.log(`[DOCS] Snapshot size: ${snapshot.size}`);

    const docs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })).sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    res.json({ success: true, data: docs });
  } catch (error: any) {
    console.error("Error fetching documents:", error);
    res.status(500).json({ success: false, error: `Error al obtener documentos: ${error.message}` });
  }
});

// Crear referencia de documento (el procesado vendrá después)
router.post("/", async (req: AuthenticatedRequest, res: Response) => {
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
  } catch (error) {
    console.error("Error creating document:", error);
    res.status(500).json({ success: false, error: "Error al crear documento" });
  }
});

// Eliminar documento
router.delete("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // Aquí también deberíamos borrar de knowledge_parts y Pinecone en el futuro
    await db.collection("knowledge_docs").doc(id).delete();
    
    res.json({ success: true, message: "Documento eliminado" });
  } catch (error) {
    console.error("Error deleting document:", error);
    res.status(500).json({ success: false, error: "Error al eliminar documento" });
  }
});

export default router;
