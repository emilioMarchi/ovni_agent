import type { NextFunction, Request, Response } from "express";
export declare function normalizeAllowedDomains(values: unknown): string[];
export declare function getRequestOriginHost(req: Request): string;
export declare function isWidgetTokenProtectionEnabled(): boolean;
export declare function issueWidgetToken(params: {
    clientId: string;
    agentId?: string;
    originHost: string;
}): {
    token: string;
    expiresAt: number;
} | null;
export declare function resolveClientId(agentId: string, providedClientId?: string): Promise<string>;
export declare function getAllowedDomainsForClient(clientId: string): Promise<string[]>;
export declare function invalidateAllowedDomainsCache(clientId: string): void;
export declare function validateWidgetAccess(req: Request): Promise<{
    allowed: boolean;
    clientId?: string;
    reason?: string;
    originHost?: string;
}>;
export declare function widgetAccessGuard(req: Request, res: Response, next: NextFunction): void | Promise<void>;
export declare function createRateLimitMiddleware(options: {
    windowMs: number;
    max: number;
    keyPrefix: string;
}): (req: Request, res: Response, next: NextFunction) => void;
