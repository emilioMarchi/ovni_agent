# ROADMAP: Desarrollo Agente OVNI v2

Este documento detalla los pasos técnicos completados para la implementación del refactor pro (Matrix 6.0).

## ✅ Fase 1: Cimentación (Setup) - COMPLETADO
- [x] Inicializar `package.json` con dependencias clave (`langgraph`, `google-genai`, `pinecone`, `firebase-admin`).
- [x] Configurar `tsconfig.json` para soporte de ESM y decoradores.
- [x] Sincronizar archivo `.env` y credenciales de Firebase.

## ✅ Fase 2: El Estado (AgentState) - COMPLETADO
- [x] Definir `src/state/state.ts` usando `Annotation.Root`.
- [x] Implementar el canal de mensajes con el reducer `messagesStateReducer`.
- [x] Configurar campos de contexto dinámicos: `clientId`, `agentId`, `userInfo`, `skills`, `functions`.

## ✅ Fase 3: Tooling (Zod-First) - COMPLETADO
- [x] Re-implementar `knowledge_retriever` (RAG Pinecone con aislamiento por `docId`).
- [x] Re-implementar `product_catalog` (Búsqueda adaptativa).
- [x] Implementar `user_profile_manager` (CRUD Firestore).
- [x] Implementar `comms_sender` (Emails via Resend).
- [x] Implementar `appointment_manager` (Google Calendar / Firestore).
- [x] **NUEVO**: Implementar `history_retriever` (Memoria a largo plazo Nivel 3).

## ✅ Fase 4: El Cerebro (Nodes) - COMPLETADO
- [x] Crear `src/nodes/config.ts`: Nodo de hidratación inicial desde Firestore.
- [x] Crear `src/nodes/model.ts`: Nodo central con Gemini 2.5 Flash Lite y filtrado dinámico de herramientas.
- [x] Crear `src/utils/SystemInstructionBuilder.ts`: Constructor de prompts Matrix 6.0.
- [x] Crear `src/nodes/tools.ts`: Nodo de ejecución de herramientas.
- [x] **NUEVO**: Crear `src/nodes/save_history.ts`: Nodo de persistencia Nivel 2 en Firestore.

## ✅ Fase 5: El Grafo (StateGraph) - COMPLETADO
- [x] Definir el grafo en `src/graph/index.ts`.
- [x] Implementar bordes condicionales (`toolsCondition`).
- [x] Integrar flujo de persistencia post-respuesta.
- [x] Integrar `MemorySaver` para persistencia de hilos en tiempo real.

## ✅ Fase 6: Validación y Pruebas - COMPLETADO
- [x] Script de prueba `test-ovni-v2.ts` (Validación de identidad y RAG).
- [x] Script de prueba `test-history-persistence.ts` (Validación Nivel 2 Firestore).
- [x] Script de migración `migrate-agent-tools.ts` (Sincronización DB v2).

## ✅ Fase 7: Panel Master Admin & Widget de Chat - COMPLETADO
- [x] Replicar lógica de gestión de Admins (CRUD).
- [x] Replicar lógica de gestión de Agentes (Configuración, Skills, Tools).
- [x] Implementar Widget de Chat embebido para pruebas de agentes en tiempo real.
- [x] Integrar autenticación Master basada en `MASTER_CLIENT_IDS`.

### Detalles de implementación:
- Servidor Express con CORS habilitado (`src/server/index.ts`)
- Middleware de autenticación Master (`src/server/middleware/auth.ts`)
- API REST Admins: `GET/POST/PUT/DELETE /api/admins` (`src/server/routes/admins.ts`)
- API REST Agentes: `GET/POST/PUT/DELETE /api/agents` (`src/server/routes/agents.ts`)
- API Chat: `POST /api/chat/invoke`, `POST /api/chat/stream` (`src/server/routes/chat.ts`)
- Widget HTML embebible (`public/widget.html`)
- Panel Master Admin HTML (`public/master-admin.html`)

### Para iniciar el servidor:
```bash
npm run dev:server
```

---
*Estado actual: v2.0.0-PROD (Arquitectura Matrix 6.0 validada)*

## 🚧 Fase 8: Mejoras de Agendado (Futuro)
- [ ] Agregar action `check_next_days` en appointment_manager (disponibilidad próximos 3-5 días)
- [ ] No crear evento en Calendar al solicitar (solo al confirmar)
- [ ] Actualizar evento en Calendar cuando admin confirma
- [ ] Enviar email de confirmación al cliente al confirmar reunión

### Mejoras opcionales del Builder (Futuro):
- [ ] Agregar flujos por config Firestore (campo `workflows` por agente)
- [ ] Agregar templates por tipo de agente (sales, support, default)
