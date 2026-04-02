import { Router, Response } from "express";
import admin from "../firebase.js";
import { AuthenticatedRequest } from "../middleware/auth.js";
import { tokenOrFallback } from "../middleware/tokenAuth.js";
import { masterAuth } from "../middleware/auth.js";

const router = Router();
const db = admin.firestore();

router.use(tokenOrFallback(masterAuth));

// Listar carpetas de un cliente
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId } = req.query;
    if (!clientId) {
      return res.status(400).json({ success: false, error: "clientId es requerido" });
    }

    const snapshot = await db.collection("knowledge_folders")
      .where("clientId", "==", clientId)
      .get();

    const folders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })).sort((a: any, b: any) => {
      const pathA = a.path || a.name || "";
      const pathB = b.path || b.name || "";
      return pathA.localeCompare(pathB);
    });

    res.json({ success: true, data: folders });
  } catch (error: any) {
    console.error("Error fetching folders:", error);
    res.status(500).json({ success: false, error: `Error al obtener carpetas: ${error.message}` });
  }
});

// Crear carpeta
router.post("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId, name, parentFolderId } = req.body;

    if (!clientId || !name) {
      return res.status(400).json({ success: false, error: "clientId y name son requeridos" });
    }

    // Validar nombre
    const cleanName = name.trim();
    if (cleanName.length < 1 || cleanName.length > 100) {
      return res.status(400).json({ success: false, error: "El nombre debe tener entre 1 y 100 caracteres" });
    }

    // Calcular path y ancestors
    let path = cleanName;
    let ancestors: string[] = [];

    if (parentFolderId) {
      const parentDoc = await db.collection("knowledge_folders").doc(parentFolderId).get();
      if (!parentDoc.exists) {
        return res.status(400).json({ success: false, error: "Carpeta padre no encontrada" });
      }
      const parentData = parentDoc.data()!;
      if (parentData.clientId !== clientId) {
        return res.status(403).json({ success: false, error: "La carpeta padre no pertenece a este cliente" });
      }
      path = `${parentData.path}/${cleanName}`;
      ancestors = [...(parentData.ancestors || []), parentFolderId];
    }

    // Verificar que no exista otra carpeta con el mismo path
    const existing = await db.collection("knowledge_folders")
      .where("clientId", "==", clientId)
      .where("path", "==", path)
      .limit(1)
      .get();

    if (!existing.empty) {
      return res.status(409).json({ success: false, error: `Ya existe una carpeta con la ruta "${path}"` });
    }

    const folderId = `folder_${Date.now()}`;
    const now = new Date().toISOString();

    const folderData = {
      clientId,
      name: cleanName,
      parentFolderId: parentFolderId || null,
      path,
      ancestors,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection("knowledge_folders").doc(folderId).set(folderData);

    res.status(201).json({ success: true, data: { id: folderId, ...folderData } });
  } catch (error: any) {
    console.error("Error creating folder:", error);
    res.status(500).json({ success: false, error: `Error al crear carpeta: ${error.message}` });
  }
});

// Renombrar carpeta
router.put("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "name es requerido" });
    }

    const folderRef = db.collection("knowledge_folders").doc(id);
    const folderSnap = await folderRef.get();
    if (!folderSnap.exists) {
      return res.status(404).json({ success: false, error: "Carpeta no encontrada" });
    }

    const folderData = folderSnap.data()!;
    const cleanName = name.trim();
    const parentPath = folderData.parentFolderId
      ? folderData.path.substring(0, folderData.path.lastIndexOf("/"))
      : "";
    const newPath = parentPath ? `${parentPath}/${cleanName}` : cleanName;

    await folderRef.update({
      name: cleanName,
      path: newPath,
      updatedAt: new Date().toISOString(),
    });

    // Actualizar paths de subcarpetas
    const childFolders = await db.collection("knowledge_folders")
      .where("clientId", "==", folderData.clientId)
      .where("ancestors", "array-contains", id)
      .get();

    if (!childFolders.empty) {
      const batch = db.batch();
      for (const child of childFolders.docs) {
        const childData = child.data();
        const updatedPath = childData.path.replace(folderData.path, newPath);
        batch.update(child.ref, { path: updatedPath, updatedAt: new Date().toISOString() });
      }
      await batch.commit();
    }

    res.json({ success: true, data: { id, name: cleanName, path: newPath } });
  } catch (error: any) {
    console.error("Error renaming folder:", error);
    res.status(500).json({ success: false, error: `Error al renombrar carpeta: ${error.message}` });
  }
});

// Eliminar carpeta (mueve documentos a sin carpeta, elimina subcarpetas)
router.delete("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const folderRef = db.collection("knowledge_folders").doc(id);
    const folderSnap = await folderRef.get();
    if (!folderSnap.exists) {
      return res.status(404).json({ success: false, error: "Carpeta no encontrada" });
    }

    const folderData = folderSnap.data()!;
    const batch = db.batch();

    // Quitar folderId de documentos en esta carpeta
    const docsInFolder = await db.collection("knowledge_docs")
      .where("folderId", "==", id)
      .get();
    for (const doc of docsInFolder.docs) {
      batch.update(doc.ref, { folderId: null, updatedAt: new Date().toISOString() });
    }

    // Eliminar subcarpetas
    const childFolders = await db.collection("knowledge_folders")
      .where("clientId", "==", folderData.clientId)
      .where("ancestors", "array-contains", id)
      .get();

    // Quitar folderId de docs en subcarpetas
    for (const child of childFolders.docs) {
      const childDocs = await db.collection("knowledge_docs")
        .where("folderId", "==", child.id)
        .get();
      for (const doc of childDocs.docs) {
        batch.update(doc.ref, { folderId: null, updatedAt: new Date().toISOString() });
      }
      batch.delete(child.ref);
    }

    // Eliminar la carpeta
    batch.delete(folderRef);
    await batch.commit();

    const totalDocs = docsInFolder.size + childFolders.docs.reduce((acc, _) => acc, 0);
    console.log(`🗑️ Carpeta ${id} eliminada (${childFolders.size} subcarpetas, ${totalDocs} docs liberados)`);

    res.json({ success: true, message: "Carpeta eliminada" });
  } catch (error: any) {
    console.error("Error deleting folder:", error);
    res.status(500).json({ success: false, error: `Error al eliminar carpeta: ${error.message}` });
  }
});

export default router;
