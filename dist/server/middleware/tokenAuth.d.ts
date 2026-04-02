import { Request, Response, NextFunction } from "express";
/**
 * Middleware estricto: requiere Authorization: Bearer <token>.
 * Rechaza si no hay token o es inválido.
 */
export declare function tokenAuth(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Middleware flexible: si hay Bearer token, lo valida y hace bypass del siguiente middleware.
 * Si no hay Bearer, delega al fallback (ej: widgetAccessGuard o masterAuth).
 * Uso: tokenOrFallback(widgetAccessGuard) o tokenOrFallback(masterAuth)
 */
export declare function tokenOrFallback(fallbackMiddleware: (req: Request, res: Response, next: NextFunction) => void): (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
