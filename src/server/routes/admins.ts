import { Router, Request, Response } from "express";
import admin from "../firebase.js";
import { v4 as uuidv4 } from "uuid";
import { Pinecone } from "@pinecone-database/pinecone";
import { masterAuth, AuthenticatedRequest } from "../middleware/auth.js";
import { invalidateAllowedDomainsCache, normalizeAllowedDomains } from "../middleware/widgetSecurity.js";

const router = Router();
const db = admin.firestore();

router.use(masterAuth);

router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const snapshot = await db.collection("admins").get();
    const admins = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.json({ success: true, data: admins });
  } catch (error) {
    console.error("Error fetching admins:", error);
    res.status(500).json({ success: false, error: "Error al obtener admins" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const doc = await db.collection("admins").doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ success: false, error: "Admin no encontrado" });
    }
    res.json({ success: true, data: { id: doc.id, ...doc.data() } });
  } catch (error) {
    console.error("Error fetching admin:", error);
    res.status(500).json({ success: false, error: "Error al obtener admin" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, email, businessName, businessContext, allowedDomains } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ success: false, error: "name y email son requeridos" });
    }

    const adminId = `org_${uuidv4().replace(/-/g, "").slice(0, 24)}`;
    const now = new Date().toISOString();

    const adminData = {
      name,
      email,
      businessName: businessName || "",
      businessContext: businessContext || "",
      allowedDomains: normalizeAllowedDomains(allowedDomains),
      createdAt: now,
      updatedAt: now,
    };

    await db.collection("admins").doc(adminId).set(adminData);

    res.status(201).json({ success: true, data: { id: adminId, ...adminData } });
  } catch (error) {
    console.error("Error creating admin:", error);
    res.status(500).json({ success: false, error: "Error al crear admin" });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { name, email, businessName, businessContext, allowedDomains } = req.body;
    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (name) updates.name = name;
    if (email) updates.email = email;
    if (businessName !== undefined) updates.businessName = businessName;
    if (businessContext !== undefined) updates.businessContext = businessContext;
    if (allowedDomains !== undefined) updates.allowedDomains = normalizeAllowedDomains(allowedDomains);

    await db.collection("admins").doc(req.params.id).update(updates);
    invalidateAllowedDomainsCache(req.params.id);

    const doc = await db.collection("admins").doc(req.params.id).get();
    res.json({ success: true, data: { id: doc.id, ...doc.data() } });
  } catch (error) {
    console.error("Error updating admin:", error);
    res.status(500).json({ success: false, error: "Error al actualizar admin" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const adminId = req.params.id;
    
    // Verificar que el admin existe
    const adminDoc = await db.collection("admins").doc(adminId).get();
    if (!adminDoc.exists) {
      return res.status(404).json({ success: false, error: "Admin no encontrado" });
    }

    const batch = db.batch();
    const deletedCounts: Record<string, number> = {};

    // 1. Obtener agentes del admin
    const agentsSnap = await db.collection("agents").where("clientId", "==", adminId).get();
    deletedCounts.agents = agentsSnap.size;

    for (const agentDoc of agentsSnap.docs) {
      const agentId = agentDoc.id;

      // 1a. Historial de cada agente
      const historySnap = await db.collection("history").where("agentId", "==", agentId).get();
      historySnap.docs.forEach(doc => batch.delete(doc.ref));
      deletedCounts.history = (deletedCounts.history || 0) + historySnap.size;

      // 1b. Checkpoints de cada conversación
      for (const histDoc of historySnap.docs) {
        const threadId = histDoc.data().threadId;
        if (threadId) {
          const cpSnap = await db.collection("checkpoints").where("thread_id", "==", threadId).get();
          cpSnap.docs.forEach(doc => batch.delete(doc.ref));
          deletedCounts.checkpoints = (deletedCounts.checkpoints || 0) + cpSnap.size;
        }
      }

      // 1c. Agent metadata
      const metaSnap = await db.collection("agent_metadata").where("agentId", "==", agentId).get();
      metaSnap.docs.forEach(doc => batch.delete(doc.ref));
      deletedCounts.agent_metadata = (deletedCounts.agent_metadata || 0) + metaSnap.size;

      // 1d. Usage logs
      const logsSnap = await db.collection("usage_logs").where("agentId", "==", agentId).get();
      logsSnap.docs.forEach(doc => batch.delete(doc.ref));
      deletedCounts.usage_logs = (deletedCounts.usage_logs || 0) + logsSnap.size;

      // 1e. Eliminar el agente
      batch.delete(agentDoc.ref);
    }

    // 2. Products del admin (pertenecen al org por clientId)
    const productsSnap = await db.collection("products").where("clientId", "==", adminId).get();
    productsSnap.docs.forEach(doc => batch.delete(doc.ref));
    deletedCounts.products = productsSnap.size;

    // 3. Knowledge docs del admin
    const kDocsSnap = await db.collection("knowledge_docs").where("clientId", "==", adminId).get();
    kDocsSnap.docs.forEach(doc => batch.delete(doc.ref));
    deletedCounts.knowledge_docs = kDocsSnap.size;

    // 4. Knowledge parts del admin
    const kPartsSnap = await db.collection("knowledge_parts").where("clientId", "==", adminId).get();
    kPartsSnap.docs.forEach(doc => batch.delete(doc.ref));
    deletedCounts.knowledge_parts = kPartsSnap.size;

    // 5. Meetings del admin
    const meetingsSnap = await db.collection("meetings").where("clientId", "==", adminId).get();
    meetingsSnap.docs.forEach(doc => batch.delete(doc.ref));
    deletedCounts.meetings = meetingsSnap.size;

    // 6. OAuth temp del admin
    const oauthSnap = await db.collection("oauth_temp").where("clientId", "==", adminId).get();
    oauthSnap.docs.forEach(doc => batch.delete(doc.ref));
    deletedCounts.oauth_temp = oauthSnap.size;

    // 7. Eliminar el admin
    batch.delete(db.collection("admins").doc(adminId));

    await batch.commit();

    // 8. Limpiar Pinecone: namespaces del admin y sus agentes
    try {
      if (process.env.PINECONE_API_KEY) {
        const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
        const index = pinecone.index("chatbot-knowledge");
        const stats = await index.describeIndexStats();

        if (stats.namespaces) {
          const agentIds = agentsSnap.docs.map(d => d.id);
          const namespacesToDelete = Object.keys(stats.namespaces).filter(ns =>
            ns === `client_${adminId}` ||
            ns === `products_client_${adminId}` ||
            ns === `document_catalog` || // TODO: filtrar solo vectores del admin
            agentIds.some(aId => ns.startsWith(`history_${aId}_`))
          );
          // No borrar document_catalog entero, solo los vectores del admin
          for (const ns of namespacesToDelete) {
            if (ns === "document_catalog") {
              // Borrar solo vectores de este admin por docId
              const docIds = kDocsSnap.docs.map(d => d.id);
              if (docIds.length > 0) {
                await index.namespace(ns).deleteMany(docIds);
              }
            } else {
              await index.namespace(ns).deleteAll();
            }
          }
          deletedCounts.pinecone_namespaces = namespacesToDelete.length;
        }
      }
    } catch (pineconeErr) {
      console.error("⚠️ Error limpiando Pinecone (admin eliminado de Firestore igualmente):", pineconeErr);
    }

    console.log(`🗑️ Admin ${adminId} eliminado con cascade:`, deletedCounts);
    res.json({ success: true, message: "Admin y todos los datos relacionados eliminados", deletedCounts });
  } catch (error) {
    console.error("Error deleting admin:", error);
    res.status(500).json({ success: false, error: "Error al eliminar admin" });
  }
});

export default router;
