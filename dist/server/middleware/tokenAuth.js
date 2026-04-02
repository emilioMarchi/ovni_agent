import admin from "../firebase.js";
/**
 * Middleware para validar Authorization: Bearer <token> y asociar clientId
 */
export async function tokenAuth(req, res, next) {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Falta Authorization Bearer token" });
    }
    const token = authHeader.slice(7);
    const db = admin.firestore();
    const snap = await db.collection("api_tokens").where("token", "==", token).where("revoked", "==", false).get();
    if (snap.empty) {
        return res.status(401).json({ error: "Token inválido o revocado" });
    }
    const tokenDoc = snap.docs[0].data();
    // Adjuntar clientId y agentId al request
    req.clientId = tokenDoc.clientId;
    req.agentId = tokenDoc.agentId;
    next();
}
//# sourceMappingURL=tokenAuth.js.map