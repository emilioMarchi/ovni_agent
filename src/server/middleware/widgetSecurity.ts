import type { NextFunction, Request, Response } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import admin from "../firebase.js";
import { isMasterClient } from "./auth.js";

const db = admin.firestore();

const AGENT_CLIENT_CACHE_TTL_MS = 5 * 60 * 1000;
const ADMIN_DOMAINS_CACHE_TTL_MS = 5 * 60 * 1000;
const WIDGET_TOKEN_SECRET = process.env.WIDGET_TOKEN_SECRET || "";
const WIDGET_TOKEN_TTL_MS = Number(process.env.WIDGET_TOKEN_TTL_MS || 10 * 60 * 1000);

const agentClientCache = new Map<string, { clientId: string; expiresAt: number }>();
const adminDomainsCache = new Map<string, { allowedDomains: string[]; expiresAt: number }>();
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

let rateLimitSweepCounter = 0;

interface WidgetTokenPayload {
  sub: "widget";
  clientId: string;
  agentId?: string;
  originHost: string;
  issuedAt: number;
  expiresAt: number;
}

function firstHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] || "";
  }
  return value || "";
}

function toUrlCandidate(value: string): string {
  return value.includes("://") ? value : `https://${value}`;
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signTokenPayload(encodedPayload: string): string {
  return createHmac("sha256", WIDGET_TOKEN_SECRET).update(encodedPayload).digest("base64url");
}

function safeCompare(value: string, expected: string): boolean {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);

  if (valueBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(valueBuffer, expectedBuffer);
}

function getWidgetTokenFromRequest(req: Request): string {
  const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
  const headerToken = firstHeaderValue(req.headers["x-ovni-widget-token"]);
  const bodyToken = typeof body.widgetToken === "string" ? body.widgetToken : "";

  return headerToken || bodyToken;
}

function isWidgetTokenRoute(req: Request): boolean {
  return req.path === "/widget-token";
}

function shouldRequireWidgetToken(req: Request): boolean {
  return Boolean(WIDGET_TOKEN_SECRET) && !isWidgetTokenRoute(req);
}

function isMasterRequest(req: Request): boolean {
  const headerClientId = firstHeaderValue(req.headers["x-client-id"]);
  return Boolean(headerClientId) && isMasterClient(headerClientId);
}

function verifyWidgetToken(token: string): WidgetTokenPayload | null {
  if (!WIDGET_TOKEN_SECRET || !token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signTokenPayload(encodedPayload);
  if (!safeCompare(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as WidgetTokenPayload;
    if (payload.sub !== "widget") return null;
    if (!payload.clientId || !payload.originHost || !payload.expiresAt) return null;
    if (payload.expiresAt <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseHost(value: string): string {
  const normalized = value.trim();
  if (!normalized) return "";

  try {
    return new URL(toUrlCandidate(normalized)).host.toLowerCase();
  } catch {
    return normalized
      .replace(/^https?:\/\//i, "")
      .split("/")[0]
      .trim()
      .toLowerCase();
  }
}

function matchesAllowedDomain(host: string, allowedDomain: string): boolean {
  if (!host || !allowedDomain) return false;

  if (allowedDomain.startsWith("*.")) {
    const suffix = allowedDomain.slice(2);
    return host === suffix || host.endsWith(`.${suffix}`);
  }

  return host === allowedDomain;
}

function extractClientIdCandidate(req: Request): string {
  const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
  const queryClientId = typeof req.query.clientId === "string" ? req.query.clientId : "";
  const bodyClientId = typeof body.clientId === "string" ? body.clientId : "";
  const headerClientId = firstHeaderValue(req.headers["x-client-id"]);

  return bodyClientId || queryClientId || headerClientId;
}

function extractAgentIdCandidate(req: Request): string {
  const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
  const queryAgentId = typeof req.query.agentId === "string" ? req.query.agentId : "";
  const bodyAgentId = typeof body.agentId === "string" ? body.agentId : "";

  return bodyAgentId || queryAgentId;
}

export function normalizeAllowedDomains(values: unknown): string[] {
  const rawValues = Array.isArray(values)
    ? values
    : typeof values === "string"
      ? values.split(/[\n,;]/)
      : [];

  return [...new Set(rawValues
    .map((value) => parseHost(String(value ?? "")))
    .filter(Boolean))];
}

export function getRequestOriginHost(req: Request): string {
  const origin = firstHeaderValue(req.headers.origin);
  if (origin) {
    return parseHost(origin);
  }

  const referer = firstHeaderValue(req.headers.referer);
  if (referer) {
    return parseHost(referer);
  }

  return "";
}

export function isWidgetTokenProtectionEnabled(): boolean {
  return Boolean(WIDGET_TOKEN_SECRET);
}

export function issueWidgetToken(params: { clientId: string; agentId?: string; originHost: string; }): { token: string; expiresAt: number } | null {
  if (!WIDGET_TOKEN_SECRET) {
    return null;
  }

  const payload: WidgetTokenPayload = {
    sub: "widget",
    clientId: params.clientId,
    agentId: params.agentId,
    originHost: params.originHost,
    issuedAt: Date.now(),
    expiresAt: Date.now() + WIDGET_TOKEN_TTL_MS,
  };

  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signTokenPayload(encodedPayload);

  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: payload.expiresAt,
  };
}

export async function resolveClientId(agentId: string, providedClientId?: string): Promise<string> {
  if (providedClientId) {
    return providedClientId;
  }

  const cached = agentClientCache.get(agentId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.clientId;
  }

  const agentDoc = await db.collection("agents").doc(agentId).get();
  const clientId = agentDoc.exists ? (agentDoc.data()?.clientId || "") : "";

  if (clientId) {
    agentClientCache.set(agentId, {
      clientId,
      expiresAt: Date.now() + AGENT_CLIENT_CACHE_TTL_MS,
    });
  }

  return clientId;
}

export async function getAllowedDomainsForClient(clientId: string): Promise<string[]> {
  if (!clientId) return [];

  const cached = adminDomainsCache.get(clientId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.allowedDomains;
  }

  const adminDoc = await db.collection("admins").doc(clientId).get();
  const allowedDomains = normalizeAllowedDomains(adminDoc.exists ? adminDoc.data()?.allowedDomains : []);

  adminDomainsCache.set(clientId, {
    allowedDomains,
    expiresAt: Date.now() + ADMIN_DOMAINS_CACHE_TTL_MS,
  });

  return allowedDomains;
}

export function invalidateAllowedDomainsCache(clientId: string): void {
  if (!clientId) return;
  adminDomainsCache.delete(clientId);
}

export async function validateWidgetAccess(req: Request): Promise<{ allowed: boolean; clientId?: string; reason?: string; originHost?: string }> {
  const providedClientId = extractClientIdCandidate(req);
  const headerClientId = firstHeaderValue(req.headers["x-client-id"]);
  const agentId = extractAgentIdCandidate(req);
  const originHost = getRequestOriginHost(req);

  if (isMasterRequest(req)) {
    const masterClientId = agentId
      ? await resolveClientId(agentId, providedClientId)
      : providedClientId || headerClientId;

    return { allowed: true, clientId: masterClientId, originHost };
  }

  const resolvedClientId = agentId
    ? await resolveClientId(agentId)
    : providedClientId;

  if (!resolvedClientId) {
    return { allowed: false, reason: "No se pudo resolver el clientId para validar el widget." };
  }

  if (headerClientId && headerClientId !== resolvedClientId) {
    return { allowed: false, clientId: resolvedClientId, reason: "El x-client-id no coincide con el agente solicitado." };
  }

  if (providedClientId && providedClientId !== resolvedClientId) {
    return { allowed: false, clientId: resolvedClientId, reason: "El clientId enviado no coincide con el agente solicitado." };
  }

  const allowedDomains = await getAllowedDomainsForClient(resolvedClientId);
  if (allowedDomains.length === 0) {
    if (shouldRequireWidgetToken(req) && !originHost) {
      return {
        allowed: false,
        clientId: resolvedClientId,
        reason: "No se pudo validar el origen del widget para emitir/verificar el token.",
      };
    }

    if (!shouldRequireWidgetToken(req)) {
      return { allowed: true, clientId: resolvedClientId, originHost };
    }
  } else {
    if (!originHost) {
      return {
        allowed: false,
        clientId: resolvedClientId,
        reason: "No se pudo validar el origen del widget porque la request no incluye Origin/Referer.",
      };
    }

    const allowed = allowedDomains.some((allowedDomain) => matchesAllowedDomain(originHost, allowedDomain));
    if (!allowed) {
      return {
        allowed: false,
        clientId: resolvedClientId,
        originHost,
        reason: `El dominio ${originHost} no está habilitado para este widget.`,
      };
    }
  }

  if (!shouldRequireWidgetToken(req)) {
    return { allowed: true, clientId: resolvedClientId, originHost };
  }

  const token = getWidgetTokenFromRequest(req);
  const payload = verifyWidgetToken(token);
  if (!payload) {
    return {
      allowed: false,
      clientId: resolvedClientId,
      originHost,
      reason: "El token del widget es inválido, faltante o expiró.",
    };
  }

  if (payload.clientId !== resolvedClientId) {
    return {
      allowed: false,
      clientId: resolvedClientId,
      originHost,
      reason: "El token del widget no corresponde al clientId solicitado.",
    };
  }

  if (agentId && payload.agentId && payload.agentId !== agentId) {
    return {
      allowed: false,
      clientId: resolvedClientId,
      originHost,
      reason: "El token del widget no corresponde al agente solicitado.",
    };
  }

  if (originHost && payload.originHost !== originHost) {
    return {
      allowed: false,
      clientId: resolvedClientId,
      originHost,
      reason: "El token del widget no corresponde al dominio de origen.",
    };
  }

  return { allowed: true, clientId: resolvedClientId, originHost };
}

export function widgetAccessGuard(req: Request, res: Response, next: NextFunction): void | Promise<void> {
  return validateWidgetAccess(req)
    .then((result) => {
      if (!result.allowed) {
        res.status(403).json({ success: false, error: result.reason || "Origen no autorizado para este widget." });
        return;
      }

      res.locals.resolvedClientId = result.clientId || "";
      res.locals.originHost = result.originHost || "";
      next();
    })
    .catch((error) => {
      console.error("Error validando acceso del widget:", error);
      res.status(500).json({ success: false, error: "No se pudo validar el acceso del widget." });
    });
}

function buildRateLimitKey(req: Request, prefix: string): string {
  const ip = req.ip || req.socket.remoteAddress || "unknown-ip";
  const originHost = getRequestOriginHost(req) || "unknown-origin";
  const clientId = extractClientIdCandidate(req) || "unknown-client";
  const agentId = extractAgentIdCandidate(req) || "unknown-agent";

  return [prefix, req.method, req.path, ip, originHost, clientId, agentId].join("|");
}

function sweepExpiredRateLimits(): void {
  rateLimitSweepCounter += 1;
  if (rateLimitSweepCounter % 250 !== 0) return;

  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

export function createRateLimitMiddleware(options: { windowMs: number; max: number; keyPrefix: string; }): (req: Request, res: Response, next: NextFunction) => void {
  const { windowMs, max, keyPrefix } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = buildRateLimitKey(req, keyPrefix);
    const current = rateLimitStore.get(key);

    sweepExpiredRateLimits();

    if (!current || current.resetAt <= now) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (current.count >= max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({
        success: false,
        error: `Se alcanzó el límite de ${max} requests cada ${Math.ceil(windowMs / 1000)} segundos. Probá nuevamente en ${retryAfterSeconds}s.`,
      });
      return;
    }

    current.count += 1;
    rateLimitStore.set(key, current);
    next();
  };
}
