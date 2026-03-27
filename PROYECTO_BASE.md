# PROYECTO: Agente OVNI v2 (Refactor Pro)

## 🛸 Visión General
Evolución del proyecto `chatbot-redes` hacia una arquitectura de **Agente Autónomo Orquestado**. Arquitectura basada en **LangGraph** para flujos de estados, persistencia de hilos y herramientas con validación estricta de Zod.

## 🏗️ Arquitectura Técnica 2.0
- **Ciclo de Razonamiento**: ReAct (Pensamiento -> Acción -> Observación -> Respuesta).
- **Persistencia**: `MemorySaver` con `thread_id` para hilos de conversación.
- **Persistencia de Sesiones**: El widget guarda el `threadId` en localStorage para retomar conversaciones entre visitas.
- **Seguridad**: Autenticación centralizada y aislamiento por `clientId`.

## 🛠️ Herramientas Clave
- **`appointment_manager`**: Gestión proactiva de agenda. Implementa flujo automático (consulta de horarios -> recolección de datos -> reserva en Firestore -> notificación).
- **`product_catalog` / `knowledge_retriever`**: RAG adaptativo por cliente.
- **Integración Calendar**: Sincronización vía OAuth 2.0 por cliente, con manejo de tokens en Firestore (`admins` collection).

## 🚀 Avances Recientes (27/03/26)
- **Historial de Sesiones con IA**: Cada conversación se analiza con Gemini para generar:
  - Resumen automático de la conversación
  - Clasificación: tipo (lead/conversation/support), nivel de interés, intenciones, temas, sentimiento
- **Endpoints de Sesiones**: `GET /api/chat/sessions` y `GET /api/chat/sessions/:threadId`
- **Persistencia de Sesiones**: El widget usa localStorage para mantener el threadId entre visitas.
- **Agendado Inteligente**: El agente ahora consulta disponibilidad de forma proactiva al detectar intención de reunión.

## 📋 Road Map de Administración (Panel Admin v2)
El siguiente paso evolutivo es descentralizar la configuración:
- [ ] **Panel Admin para Clientes**: Panel independiente donde cada `clientId` puede:
    - Conectar su propio Google Calendar vía OAuth.
    - Configurar sus propios `businessHours`.
    - Gestionar sus propios agentes y herramientas.
    - Aprobar/Rechazar solicitudes de reuniones de sus clientes.
- [ ] **Gestión de Agentes**: UI para asignar `skills` y `functions` de forma dinámica por `agentId`.

## 🏗️ Infraestructura y Escalamiento (Fase Producción)
Mejoras arquitectónicas pendientes para soportar alta demanda:
- [ ] **Persistencia Robusta**: Migrar `MemorySaver` (actualmente en RAM) a una base de datos persistente (Postgres/Firestore) para mantener conversaciones activas tras reinicios del servidor.
- [ ] **Rate Limiting**: Implementar limitación de peticiones por IP o `clientId` (via Nginx o middleware Express) para prevenir abusos.
- [ ] **Logging Estructurado**: Centralizar logs (ej: Winston/Datadog) etiquetados por `clientId` para facilitar depuración en entorno multi-tenant.
- [ ] **Seguridad Chat**: Implementar tokens temporales o firma de peticiones para el widget de chat, evitando uso no autorizado de la API.

---
*Última actualización: 24 de marzo de 2026*
