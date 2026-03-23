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

---
*Estado actual: v2.0.0-PROD (Arquitectura Matrix 6.0 validada)*
