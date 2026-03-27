import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";

import "./firebase.js";
import authRouter from "./routes/auth.js";
import adminsRouter from "./routes/admins.js";
import agentsRouter from "./routes/agents.js";
import documentsRouter from "./routes/documents.js";
import chatRouter from "./routes/chat.js";
import meetingsRouter from "./routes/meetings.js";
import { validateClientFormat } from "./middleware/auth.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-client-id"],
}));
app.use(express.json());
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
