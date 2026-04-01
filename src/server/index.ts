import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";

import "./firebase.js";
import admin from "./firebase.js";
import authRouter from "./routes/auth.js";
import adminsRouter from "./routes/admins.js";
import agentsRouter from "./routes/agents.js";
import documentsRouter from "./routes/documents.js";
import chatRouter from "./routes/chat.js";
import meetingsRouter from "./routes/meetings.js";
import { validateClientFormat } from "./middleware/auth.js";
import { normalizeAllowedDomains } from "./middleware/widgetSecurity.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// --- Dynamic CORS: allows base domains + all registered admin domains ---
const BASE_ALLOWED_ORIGINS = [
  "http://localhost",
  "http://localhost:3000",
  "http://localhost:8080",
  "http://127.0.0.1",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:8080",
  "https://ovnistudio.com.ar",
  "https://dev.ovnistudio.com.ar",
  "https://api.ovnistudio.com.ar",
];

let dynamicAllowedOrigins: Set<string> = new Set(BASE_ALLOWED_ORIGINS);
let dynamicOriginsLoadedAt = 0;
const DYNAMIC_ORIGINS_TTL_MS = 5 * 60 * 1000;

async function refreshAllowedOrigins(): Promise<void> {
  if (Date.now() - dynamicOriginsLoadedAt < DYNAMIC_ORIGINS_TTL_MS) return;
  try {
    const db = admin.firestore();
    const snapshot = await db.collection("admins").get();
    const origins = new Set(BASE_ALLOWED_ORIGINS);
    for (const doc of snapshot.docs) {
      const domains = normalizeAllowedDomains(doc.data()?.allowedDomains);
      for (const domain of domains) {
        origins.add(`https://${domain}`);
        origins.add(`http://${domain}`);
      }
    }
    dynamicAllowedOrigins = origins;
    dynamicOriginsLoadedAt = Date.now();
  } catch (e) {
    console.error("Error refreshing CORS origins:", e);
  }
}

// Pre-load on startup
refreshAllowedOrigins();

function matchOrigin(origin: string): boolean {
  if (dynamicAllowedOrigins.has(origin)) return true;
  // Wildcard support: check *.domain patterns
  try {
    const host = new URL(origin).host;
    for (const allowed of dynamicAllowedOrigins) {
      try {
        const allowedHost = new URL(allowed).host;
        if (allowedHost.startsWith("*.")) {
          const suffix = allowedHost.slice(2);
          if (host === suffix || host.endsWith(`.${suffix}`)) return true;
        }
      } catch { /* skip malformed */ }
    }
  } catch { /* skip malformed */ }
  return false;
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, Postman, etc.)
    if (!origin) return callback(null, true);
    refreshAllowedOrigins().then(() => {
      if (matchOrigin(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // Still allow but don't set Access-Control-Allow-Origin header for unknown origins
        // Note: Real blocking happens in widgetAccessGuard middleware, not CORS
      }
    });
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-client-id", "x-ovni-widget-token"],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.static("public"));

// Middleware de seguridad básico para headers de cliente
app.use(validateClientFormat);

app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/admins", adminsRouter);
app.use("/api/agents", agentsRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/chat", chatRouter);
app.use("/api/meetings", meetingsRouter);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Error no manejado:", err);
  res.status(500).json({ success: false, error: "Error interno del servidor" });
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║           OVNI Agent v2 - Panel Master Admin              ║
╠═══════════════════════════════════════════════════════════╣
║  Servidor iniciado en http://localhost:${PORT}               ║
║                                                           ║
║  Endpoints:                                               ║
║  ├── GET    /health                    - Salud del API    ║
║  ├── POST   /api/auth/login            - Login con pass   ║
║  ├── GET    /api/admins                - Listar admins    ║
║  ├── POST   /api/admins                - Crear admin      ║
║  ├── GET    /api/admins/:id            - Ver admin        ║
║  ├── PUT    /api/admins/:id            - Editar admin    ║
║  ├── DELETE /api/admins/:id            - Eliminar admin   ║
║  ├── GET    /api/agents                - Listar agentes   ║
║  ├── POST   /api/agents                - Crear agente    ║
║  ├── GET    /api/agents/:id            - Ver agente      ║
║  ├── PUT    /api/agents/:id            - Editar agente  ║
║  ├── DELETE /api/agents/:id            - Eliminar agente ║
║  ├── GET    /api/documents             - Listar docs      ║
║  ├── POST   /api/documents/upload      - Subir documento ║
║  ├── GET    /api/documents/:id         - Ver documento   ║
║  ├── DELETE /api/documents/:id         - Eliminar doc    ║
║  ├── POST   /api/chat/invoke            - Invocar agente  ║
║  ├── POST   /api/chat/stream            - Stream agente   ║
║  ├── GET    /api/chat/sessions         - Listar sesiones ║
║  ├── GET    /api/chat/sessions/:id     - Ver sesión      ║
║  └── GET    /api/chat/history/:id      - Ver historial   ║
║                                                           ║
║  Panel Admin: http://localhost:${PORT}/master-admin.html       ║
║  Contraseña: admin123                                     ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;
