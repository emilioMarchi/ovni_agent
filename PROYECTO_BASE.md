# PROYECTO: Agente OVNI v2 (Refactor Pro)

## 🛸 Visión General
Evolución del proyecto `chatbot-redes` hacia una arquitectura de **Agente Autónomo Orquestado**. Abandonamos la lógica secuencial por un flujo basado en grafos de estado con **LangGraph**.

## 🏗️ Arquitectura Técnica 2.0
### Patrón: ReAct con Grafo de Estados (LangGraph)
- **Ciclo de Razonamiento**: El agente usa un bucle de Pensamiento (Thinking) -> Acción (Tools) -> Observación -> Respuesta.
- **Estado (AgentState)**: Objeto inmutable compartido entre nodos, gestionado por `Annotation.Root`.
- **Persistencia (Checkpointer)**: Uso de `MemorySaver` para persistencia de hilos (Thread-level) que permite retomar conversaciones rotas.
- **Validación Estricta**: Esquemas de **Zod** para todas las entradas/salidas de herramientas.

## 🛠️ Catálogo de Herramientas (Tools)
1.  **`knowledge_retriever`**: Búsqueda semántica en Pinecone (namespace cliente). RAG principal.
2.  **`product_catalog`**: Búsqueda en catálogo de productos (namespace productos).
3.  **`user_profile_manager`**: CRUD en Firestore para perfiles de usuario y `flowState`.
4.  **`comms_sender`**: Envío de emails vía Resend y notificaciones.
5.  **`appointment_manager`**: Gestión de disponibilidad y citas en Google Calendar.

## 🗺️ Mapa de Versiones
### v2.0.0 (Actual) - El Gran Refactor
- [ ] Fase 1: Cimentación (Config, Deps, Env).
- [ ] Fase 2: Estado y Memoria (AgentState, MemorySaver).
- [ ] Fase 3: Tooling (Re-implementación lógica con Zod).
- [ ] Fase 4: Cerebro y Lógica (Nodo Modelo, Modo Thinking).
- [ ] Fase 5: Ensamblaje del Grafo (StateGraph, Bordes Condicionales).
- [ ] Fase 6: Validación y Deploy.

### v2.1.0 - Multi-Agent Ready
- [ ] Separación de tareas entre un "Supervisor" y "Workers" (Ventas, Soporte, Admin).

## 📋 Arquitectura de Datos
- **State**: Centralizado en `AgentState` usando `Annotation`.
- **Tools**: Validadas estrictamente con **Zod**.
- **Namespacing**: Aislamiento por `clientId` y `agentId` en todas las capas (Firestore/Pinecone).

---
*Última actualización: 22 de marzo de 2026*
