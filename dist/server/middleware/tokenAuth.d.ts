import { Request, Response, NextFunction } from "express";
/**
 * Middleware para validar Authorization: Bearer <token> y asociar clientId
 */
export declare function tokenAuth(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
