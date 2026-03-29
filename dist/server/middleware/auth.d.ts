import { Request, Response, NextFunction } from "express";
export interface AuthenticatedRequest extends Request {
    masterClientId?: string;
}
export declare function masterAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void;
export declare function isMasterClient(clientId: string): boolean;
export declare function verifyMasterPassword(password: string): boolean;
export declare function getMasterClientId(): string;
/**
 * Middleware para validar formato básico de x-client-id en rutas públicas.
 * Previene inyecciones simples y IDs malformados.
 */
export declare function validateClientFormat(req: Request, res: Response, next: NextFunction): void;
