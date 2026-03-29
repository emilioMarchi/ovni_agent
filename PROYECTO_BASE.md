# PROYECTO: Agente OVNI v2 (Refactor Pro)

## 🛸 Visión General
Evolución del proyecto `chatbot-redes` hacia una arquitectura de **Agente Autónomo Orquestado**. Arquitectura basada en **LangGraph** para flujos de estados, persistencia de hilos y herramientas con validación estricta de Zod.

## 🏗️ Arquitectura Técnica 2.0
- **Ciclo de Razonamiento**: ReAct (Pensamiento -> Acción -> Observación -> Respuesta).
- **Persistencia**: `MemorySaver` con `thread_id` para hilos de conversación.
- **Persistencia de Sesiones**: El widget guarda el `threadId` en localStorage para retomar conversaciones entre visitas.
- **Seguridad**: Autenticación centralizada y aislamiento por `clientId`.
- **RAG Bajo Demanda**: El sistema ya no hace prefetch automático de conocimiento; el modelo decide cuándo consultar documentos usando `knowledge_retriever`.
- **Fast Path Conversacional**: Inputs simples conservan contexto mínimo reciente, pero saltean procesos caros innecesarios.

## 🛠️ Herramientas Clave
- **`appointment_manager`**: Gestión proactiva de agenda con preconfirmación obligatoria antes de crear la solicitud.
- **`product_catalog` / `knowledge_retriever`**: Recuperación híbrida con fallback cruzado entre catálogo estructurado y documentos del negocio.
- **Integración Calendar**: Sincronización vía OAuth 2.0 por cliente, con manejo de tokens en Firestore (`admins` collection).

## 🚀 Avances Recientes (29/03/26)
- **Historial de Sesiones con IA**: Cada conversación se analiza con Gemini para generar:
  - Resumen automático de la conversación
  - Clasificación: tipo (lead/conversation/support), nivel de interés, intenciones, temas, sentimiento
- **Endpoints de Sesiones**: `GET /api/chat/sessions` y `GET /api/chat/sessions/:threadId`
- **Persistencia de Sesiones**: El widget usa localStorage para mantener el threadId entre visitas.
- **Agendado Inteligente**: El agente consulta disponibilidad de forma proactiva y ahora resume fecha, hora y datos de contacto antes de solicitar la reunión.
- **Optimización de Latencia**: Cache de metadata/configuración del agente, eliminación del RAG automático y fast-path para mensajes simples.
- **Modo Audio Mejorado**: Voz más consistente, horarios normalizados para habla natural, respuestas verbales resumidas y widget con botón para ver el texto de una respuesta de audio.
- **Recuperación Híbrida**: Si la información no aparece en productos, el sistema revisa documentos; si no aparece en documentos y la consulta parece de catálogo, revisa productos.

## 📋 Road Map de Administración (Panel Admin v2)
El siguiente paso evolutivo es descentralizar la configuración:
- [ ] **Panel Admin para Clientes**: Panel independiente donde cada `clientId` puede:
    - Conectar su propio Google Calendar vía OAuth.
    - Configurar sus propios `businessHours`.
    - Gestionar sus propios agentes y herramientas.
    - Aprobar/Rechazar solicitudes de reuniones de sus clientes.
- [ ] **Gestión de Agentes**: UI para asignar `skills` y `functions` de forma dinámica por `agentId`.
- [ ] **Búsqueda Semántica de Funciones**: Incorporar selección semántica de tools/funciones vía Pinecone para complementar el routing estático actual.
- [ ] **Sincronización de Catálogo de Funciones**: Normalizar `global_functions` y `function_groups` en Pinecone según las tools reales del código y remover funciones legacy o inexistentes.
- [ ] **Búsqueda Semántica de Productos**: Definir ingesta de catálogo hacia Pinecone y recuperación semántica usando Firestore o documentos como fuente de verdad.

## 🏗️ Infraestructura y Escalamiento (Fase Producción)
Mejoras arquitectónicas pendientes para soportar alta demanda:
- [ ] **Persistencia Robusta**: Migrar `MemorySaver` (actualmente en RAM) a una base de datos persistente (Postgres/Firestore) para mantener conversaciones activas tras reinicios del servidor.
- [ ] **Rate Limiting**: Implementar limitación de peticiones por IP o `clientId` (via Nginx o middleware Express) para prevenir abusos.
- [ ] **Logging Estructurado**: Centralizar logs (ej: Winston/Datadog) etiquetados por `clientId` para facilitar depuración en entorno multi-tenant.
- [ ] **Seguridad Chat**: Implementar tokens temporales o firma de peticiones para el widget de chat, evitando uso no autorizado de la API.

---
*Última actualización: 29 de marzo de 2026*
