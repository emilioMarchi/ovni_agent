import dotenv from "dotenv";
dotenv.config();
const MASTER_PASSWORD = process.env.MASTER_ADMIN_PASSWORD || "admin123";
const MASTER_CLIENT_ID = process.env.MASTER_CLIENT_ID || process.env.MASTER_CLIENT_IDS?.split(",")[0] || "";
export function masterAuth(req, res, next) {
    const clientId = req.headers["x-client-id"];
    if (!clientId) {
        res.status(401).json({ error: "Falta x-client-id header" });
        return;
    }
    if (clientId !== MASTER_CLIENT_ID) {
        res.status(403).json({ error: "Acceso denegado. No tienes permisos de Master Admin." });
        return;
    }
    req.masterClientId = clientId;
    next();
}
export function isMasterClient(clientId) {
    const clients = process.env.MASTER_CLIENT_IDS?.split(",") || [];
    return clients.includes(clientId);
}
export function verifyMasterPassword(password) {
    return password === MASTER_PASSWORD;
}
export function getMasterClientId() {
    return MASTER_CLIENT_ID;
}
/**
 * Middleware para validar formato básico de x-client-id en rutas públicas.
 * Previene inyecciones simples y IDs malformados.
 */
export function validateClientFormat(req, res, next) {
    const clientId = req.headers["x-client-id"];
    // Rutas exentas de toda validación
    if (req.path === "/health" || req.path.startsWith("/api/auth") || req.path.includes("/google-calendar/callback") || req.method === "OPTIONS") {
        next();
        return;
    }
    if (req.path.includes("/confirm") || req.path.includes("/reject")) {
        next();
        return;
    }
    // Si no hay x-client-id, pasar: cada ruta tiene su propio middleware de auth
    // (masterAuth, widgetAccessGuard, tokenOrFallback) que decidirá si rechazar o no.
    if (!clientId) {
        next();
        return;
    }
    // Si hay x-client-id, sanitizar formato contra inyección
    const clientRegex = /^[a-zA-Z0-9_-]{1,64}$/;
    if (!clientRegex.test(clientId)) {
        res.status(400).json({ error: "Formato de x-client-id inválido o inseguro." });
        return;
    }
    next();
}
//# sourceMappingURL=auth.js.map