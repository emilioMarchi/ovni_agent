import { Router, Request, Response } from "express";
import { verifyMasterPassword, getMasterClientId } from "../middleware/auth.js";

const router = Router();

router.post("/login", (req: Request, res: Response) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ success: false, error: "Contraseña requerida" });
  }

  if (!verifyMasterPassword(password)) {
    return res.status(401).json({ success: false, error: "Contraseña incorrecta" });
  }

  res.json({
    success: true,
    clientId: getMasterClientId(),
    message: "Login exitoso"
  });
});

router.post("/verify", (req: Request, res: Response) => {
  const clientId = req.headers["x-client-id"] as string;
  
  if (clientId === getMasterClientId()) {
    res.json({ success: true, valid: true });
  } else {
    res.status(401).json({ success: false, valid: false });
  }
});

export default router;
