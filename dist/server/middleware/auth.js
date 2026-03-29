import dotenv from "dotenv";
dotenv.config();
const MASTER_PASSWORD = process.env.MASTER_ADMIN_PASSWORD || "admin123";
const MASTER_CLIENT_ID = process.env.MASTER_CLIENT_IDS?.split(",")[0] || "";
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
    // Rutas exentas de validación de client-id (health, auth master, callbacks oauth, confirmación de reuniones por URL params)
    if (req.path === "/health" || req.path.startsWith("/api/auth") || req.path.includes("/google-calendar/callback") || req.method === "OPTIONS") {
        next();
        return;
    }
    // Excepción para rutas de confirmación de reunión que usan ID en URL param, no header
    if (req.path.includes("/confirm") || req.path.includes("/reject")) {
        next();
        return;
    }
    if (!clientId) {
        // Si es una ruta que debería tener client-id pero no lo tiene
        // (Ajustar según necesidad, algunas rutas públicas podrían no requerirlo)
        if (req.path.startsWith("/api/chat") || req.path.startsWith("/api/agents")) {
            res.status(400).json({ error: "Falta x-client-id header requerido para esta operación." });
            return;
        }
        next();
        return;
    }
    // Regex permisivo para UUIDs y strings tipo "org_..."
    const clientRegex = /^[a-zA-Z0-9_-]{1,64}$/;
    if (!clientRegex.test(clientId)) {
        res.status(400).json({ error: "Formato de x-client-id inválido o inseguro." });
        return;
    }
    next();
}
//# sourceMappingURL=auth.js.map