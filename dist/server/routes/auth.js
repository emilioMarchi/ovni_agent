import { Router } from "express";
import { verifyMasterPassword, getMasterClientId } from "../middleware/auth.js";
const router = Router();
router.post("/login", (req, res) => {
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
router.post("/verify", (req, res) => {
    const clientId = req.headers["x-client-id"];
    if (clientId === getMasterClientId()) {
        res.json({ success: true, valid: true });
    }
    else {
        res.status(401).json({ success: false, valid: false });
    }
});
export default router;
//# sourceMappingURL=auth.js.map