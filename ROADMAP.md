# ROADMAP: Desarrollo Agente OVNI v2

Este documento detalla los pasos técnicos para la implementación del refactor pro.

## 🏁 Fase 1: Cimentación (Setup)
- [ ] Inicializar `package.json` con dependencias clave:
    - `@langchain/langgraph`
    - `@langchain/google-genai`
    - `@langchain/community` (para Pinecone/Firestore)
    - `zod`
    - `firebase-admin`
    - `@pinecone-database/pinecone`
    - `resend`
- [ ] Configurar `tsconfig.json` para soporte de decoradores y ESM.
- [ ] Crear archivo `.env` basado en el proyecto anterior.

## 🧠 Fase 2: El Estado (AgentState)
- [ ] Definir `src/state/state.ts` usando `Annotation.Root`.
- [ ] Implementar el canal de mensajes con el reducer `addMessages`.
- [ ] Configurar campos de contexto: `clientId`, `agentId`, `userInfo`.

## 🛠️ Fase 3: Tooling (Zod-First)
- [ ] Re-implementar `retriever_tool` para Pinecone.
- [ ] Re-implementar `db_tool` para Firestore (perfiles).
- [ ] Configurar la lógica de "Tool Discovery" (el agente sabe qué herramientas tiene disponibles).

## ⚡ Fase 4: El Cerebro (Nodes)
- [ ] Crear `src/nodes/model.ts`: Nodo central que llama a Gemini 2.5 Flash Lite.
- [ ] Configurar el `SystemPrompt` dinámico que inyecta el `AGENT.md` y el `businessContext` de Firestore.
- [ ] Crear `src/nodes/tools.ts`: Nodo de ejecución de herramientas.

## 🕸️ Fase 5: El Grafo (StateGraph)
- [ ] Definir el grafo en `src/graph/index.ts`.
- [ ] Implementar bordes condicionales (`shouldContinue`).
- [ ] Integrar `MemorySaver` para persistencia de hilos.

## ✅ Fase 6: Validación y Pruebas
- [ ] Script de prueba `test-ovni-v2.ts`.
- [ ] Verificación de recuperación de memoria tras interrupción.
- [ ] Test de RAG multitenant (aislamiento por `clientId`).

---
*Estado actual: Fase 1 (Pendiente)*
