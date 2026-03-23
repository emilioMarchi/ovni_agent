import { Router, Request, Response } from "express";
import admin from "../firebase.js";
import { v4 as uuidv4 } from "uuid";
import { masterAuth, AuthenticatedRequest } from "../middleware/auth.js";

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
    const { name, email, businessName, businessContext } = req.body;
    
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
    const { name, email, businessName, businessContext } = req.body;
    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (name) updates.name = name;
    if (email) updates.email = email;
    if (businessName !== undefined) updates.businessName = businessName;
    if (businessContext !== undefined) updates.businessContext = businessContext;

    await db.collection("admins").doc(req.params.id).update(updates);

    const doc = await db.collection("admins").doc(req.params.id).get();
    res.json({ success: true, data: { id: doc.id, ...doc.data() } });
  } catch (error) {
    console.error("Error updating admin:", error);
    res.status(500).json({ success: false, error: "Error al actualizar admin" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    await db.collection("admins").doc(req.params.id).delete();
    res.json({ success: true, message: "Admin eliminado" });
  } catch (error) {
    console.error("Error deleting admin:", error);
    res.status(500).json({ success: false, error: "Error al eliminar admin" });
  }
});

export default router;
