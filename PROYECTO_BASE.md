# PROYECTO: Agente OVNI v2 (Refactor Pro)

## 🛸 Visión General
Evolución del proyecto `chatbot-redes` hacia una arquitectura de **Agente Autónomo Orquestado**. Abandonamos la lógica secuencial por un flujo basado en grafos de estado con **LangGraph**.

## 🏗️ Stack Tecnológico
- **Orquestador**: LangGraph (Node.js/TypeScript)
- **Cerebro**: Gemini 2.5 Flash Lite (Google Gen AI SDK)
- **Memoria Semántica**: Pinecone (3 niveles de cascada: Sesión, Historial, Global)
- **Persistencia**: Firestore (Configuración, Metadatos y Backups)
- **Comunicaciones**: Resend (Emails) y Google Calendar (Citas)

## 🗺️ Mapa de Versiones
### v2.0.0 (Actual) - El Gran Refactor
- [ ] Configuración inicial de LangGraph con `Annotation.Root`.
- [ ] Implementación de `MemorySaver` para persistencia nativa de hilos (threads).
- [ ] Migración de RAG manual a `retriever_tool` (Pinecone-first).
- [ ] Refactor de `MeetingFlow` a nodos de decisión en el grafo.

### v2.1.0 - Multi-Agent Ready
- [ ] Separación de tareas entre un "Supervisor" y "Workers" (Ventas, Soporte, Admin).

## 📋 Arquitectura de Datos
- **State**: Centralizado en `AgentState` usando `Annotation`.
- **Tools**: Validadas estrictamente con **Zod**.
- **Namespacing**: Aislamiento por `clientId` y `agentId` en todas las capas (Firestore/Pinecone).

---
*Última actualización: 22 de marzo de 2026*
