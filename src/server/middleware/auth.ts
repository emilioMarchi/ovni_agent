import { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";

dotenv.config();

const MASTER_PASSWORD = process.env.MASTER_ADMIN_PASSWORD || "admin123";
const MASTER_CLIENT_ID = process.env.MASTER_CLIENT_IDS?.split(",")[0] || "";

export interface AuthenticatedRequest extends Request {
  masterClientId?: string;
}

export function masterAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const clientId = req.headers["x-client-id"] as string;

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

export function isMasterClient(clientId: string): boolean {
  const clients = process.env.MASTER_CLIENT_IDS?.split(",") || [];
  return clients.includes(clientId);
}

export function verifyMasterPassword(password: string): boolean {
  return password === MASTER_PASSWORD;
}

export function getMasterClientId(): string {
  return MASTER_CLIENT_ID;
}
