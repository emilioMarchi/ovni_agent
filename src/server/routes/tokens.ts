import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import admin from "../firebase.js";
import { masterAuth } from "../middleware/auth.js";

const router = Router();
const db = admin.firestore();

// Generar nuevo token/API key
router.post("/generate", masterAuth, async (req: Request, res: Response) => {
  const { clientId, agentId, description } = req.body;
  if (!clientId) return res.status(400).json({ error: "clientId requerido" });
  const token = uuidv4();
  const tokenDoc = {
    token,
    clientId,
    agentId: agentId || null,
    description: description || "",
    createdAt: new Date().toISOString(),
    revoked: false,
  };
  await db.collection("api_tokens").add(tokenDoc);
  res.json({ success: true, token });
});

// Listar tokens activos
router.get("/", masterAuth, async (req: Request, res: Response) => {
  const { clientId } = req.query;
  if (!clientId) return res.status(400).json({ error: "clientId requerido" });
  const snap = await db.collection("api_tokens").where("clientId", "==", clientId).where("revoked", "==", false).get();
  const tokens = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  res.json({ success: true, tokens });
});

// Revocar token
router.delete("/:tokenId", masterAuth, async (req: Request, res: Response) => {
  const { tokenId } = req.params;
  if (!tokenId) return res.status(400).json({ error: "tokenId requerido" });
  await db.collection("api_tokens").doc(tokenId).update({ revoked: true });
  res.json({ success: true });
});

export default router;
