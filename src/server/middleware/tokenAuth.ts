import { Request, Response, NextFunction } from "express";
import admin from "../firebase.js";
import { createHash } from "node:crypto";

/**
 * Middleware estricto: requiere Authorization: Bearer <token>.
 * Rechaza si no hay token o es inválido.
 */
export async function tokenAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Falta Authorization Bearer token" });
  }
  const rawToken = authHeader.slice(7);
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const db = admin.firestore();
  const snap = await db.collection("api_tokens").where("token", "==", tokenHash).where("revoked", "==", false).get();
  if (snap.empty) {
    return res.status(401).json({ error: "Token inválido o revocado" });
  }
  const tokenDoc = snap.docs[0].data();
  (req as any).tokenClientId = tokenDoc.clientId;
  (req as any).tokenAgentId = tokenDoc.agentId;
  (req as any).authenticatedByToken = true;
  next();
}

/**
 * Middleware flexible: si hay Bearer token, lo valida y hace bypass del siguiente middleware.
 * Si no hay Bearer, delega al fallback (ej: widgetAccessGuard o masterAuth).
 * Uso: tokenOrFallback(widgetAccessGuard) o tokenOrFallback(masterAuth)
 */
export function tokenOrFallback(fallbackMiddleware: (req: Request, res: Response, next: NextFunction) => void) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers["authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const rawToken = authHeader.slice(7);
        const tokenHash = createHash("sha256").update(rawToken).digest("hex");
        const db = admin.firestore();
        const snap = await db.collection("api_tokens").where("token", "==", tokenHash).where("revoked", "==", false).get();
        if (!snap.empty) {
          const tokenDoc = snap.docs[0].data();
          (req as any).tokenClientId = tokenDoc.clientId;
          (req as any).tokenAgentId = tokenDoc.agentId;
          (req as any).authenticatedByToken = true;
          // Set headers that downstream code expects
          if (!req.headers["x-client-id"]) {
            req.headers["x-client-id"] = tokenDoc.clientId;
          }
          return next();
        }
        return res.status(401).json({ error: "Token inválido o revocado" });
      } catch (e) {
        console.error("Error verificando token:", e);
        return res.status(503).json({ error: "Error verificando autenticación" });
      }
    }
    // No Bearer header → use fallback auth
    fallbackMiddleware(req, res, next);
  };
}
