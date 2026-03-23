# PROYECTO: Agente OVNI v2 (Refactor Pro)

## 🛸 Visión General
Evolución del proyecto `chatbot-redes` hacia una arquitectura de **Agente Autónomo Orquestado**. Arquitectura basada en **LangGraph** para flujos de estados, persistencia de hilos y herramientas con validación estricta de Zod.

## 🏗️ Arquitectura Técnica 2.0
- **Ciclo de Razonamiento**: ReAct (Pensamiento -> Acción -> Observación -> Respuesta).
- **Persistencia**: `MemorySaver` con `thread_id` para hilos de conversación.
- **Seguridad**: Autenticación centralizada y aislamiento por `clientId`.

## 🛠️ Herramientas Clave
- **`appointment_manager`**: Gestión proactiva de agenda. Implementa flujo automático (consulta de horarios -> recolección de datos -> reserva en Firestore -> notificación).
- **`product_catalog` / `knowledge_retriever`**: RAG adaptativo por cliente.
- **Integración Calendar**: Sincronización vía OAuth 2.0 por cliente, con manejo de tokens en Firestore (`admins` collection).

## 🚀 Avances Recientes (23/03/26)
- **Agendado Inteligente**: El agente ahora consulta disponibilidad de forma proactiva al detectar intención de reunión, evitando alucinaciones mediante el uso estricto de herramientas.
- **Ciclo de Vida de Reunión**: Implementado el proceso de solicitud (pendiente) y confirmación vía email (POST/GET a `/api/meetings/:id/confirm`).
- **Sincronización Calendar**: Integración con Google Calendar configurada por cliente, almacenando tokens de acceso en la colección `admins`.

## 📋 Road Map de Administración (Panel Admin v2)
El siguiente paso evolutivo es descentralizar la configuración:
- [ ] **Panel Admin para Clientes**: Panel independiente donde cada `clientId` puede:
    - Conectar su propio Google Calendar vía OAuth.
    - Configurar sus propios `businessHours`.
    - Gestionar sus propios agentes y herramientas.
    - Aprobar/Rechazar solicitudes de reuniones de sus clientes.
- [ ] **Gestión de Agentes**: UI para asignar `skills` y `functions` de forma dinámica por `agentId`.

---
*Última actualización: 23 de marzo de 2026*
