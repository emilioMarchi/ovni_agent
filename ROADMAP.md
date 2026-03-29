# ROADMAP: Desarrollo Agente OVNI v2

Este documento detalla el progreso y la planificación del Agente OVNI v2 (Matrix 6.0).

## ✅ Fase 1 a 6: Core del Sistema - COMPLETADO
- [x] Arquitectura de Grafo con LangGraph.
- [x] Persistencia de historial Nivel 2 (Firestore) y Nivel 3 (Long-term Memory).
- [x] Herramientas Pro (Calendar, Resend, User Profile, RAG Adaptativo).
- [x] Hydración dinámica de agentes desde Firestore.

## ✅ Fase 7: Panel Master Admin & Gestión - COMPLETADO
- [x] CRUD completo de Admins (Organizaciones).
- [x] CRUD refinado de Agentes (Roles, Tipos, Perfiles).
- [x] **Gestión de Documentos (v1)**: Pestaña de documentos y vinculación de IDs a cada agente.
- [x] **Formularios Pro**: Refinamiento de UI/UX en Master Admin para configuración granular.
- [x] Widget de Chat embebido para pruebas.

## ✅ Fase 8: UX, Agendado y Branding - COMPLETADO
- [x] Flujo proactivo de recolección de datos para citas.
- [x] Sincronización de tokens de Google Calendar por Admin.
- [x] Notificaciones por Email (Resend) con diseño Dark Mode.
- [x] Favicons, logos y consistencia visual de marca.

---

## ✅ Fase 9: Ingesta y Procesamiento RAG - COMPLETADO
- [x] **Subida Real**: Implementado selector de archivos y endpoint `/api/documents/upload`.
- [x] **Procesamiento de Contenido**: Extracción de PDF/TXT/XLSX/JSON con normalización de texto.
- [x] **Vectorización**: Sistema de 2 niveles (Catálogo y Fragmentos) en Pinecone.
- [x] **Estado**: Implementado status `processing` -> `ready` con feedback visual en el panel.
- [x] **Puntería Pro**: Query Expansion con Gemini 2.5 Flash para búsquedas ultra-precisas.

---

## ✅ Fase 10: Historial y Clasificación de Sesiones - COMPLETADO
- [x] **Endpoints de Sesiones**: `GET /api/chat/sessions` y `GET /api/chat/sessions/:threadId`
- [x] **Análisis con Gemini**: Resumen automático, clasificación (lead/conversation/support), nivel de interés, intenciones, temas, sentimiento
- [x] **Persistencia de Sesiones**: localStorage en widget para retomar conversaciones

---

## 🚀 Fase 11: Tool Intelligence (Tool RAG)
- [ ] **Tool RAG**: Indexar descripciones de herramientas en Pinecone (`tool_catalog`).
- [ ] **Detector de Intención**: Nodo previo al modelo que selecciona dinámicamente las 3-5 herramientas más relevantes.
- [ ] **Búsqueda Semántica de Funciones**: Consultar Pinecone para resolver funciones/capacidades relevantes en lugar de depender solo de mapeos estáticos y routing manual.
- [ ] **Sincronización de Catálogo de Funciones**: Alinear `global_functions` y `function_groups` de Pinecone con las tools y funciones reales de la app, eliminando entradas legacy o huérfanas.
- [ ] **Búsqueda Semántica de Productos**: Indexar catálogo en Pinecone (`products_<clientId>`) y recuperar candidatos por similitud vectorial antes de hidratar detalles desde Firestore o documentos.

---

## 🕒 Futuro: Optimizaciones
- [ ] **Fragmentación Semántica**: Usar IA para dividir documentos en secciones lógicas en lugar de cortes por caracteres/oraciones.
- [ ] **Builder de Workflows**: Configurar flujos de estados por agente desde Firestore.
- [ ] **Templates**: Plantillas preconfiguradas por industria.
- [ ] **Analytics**: Panel de uso de tokens y efectividad de respuestas.
- [ ] **Builder de Workflows**: Configurar flujos de estados por agente desde Firestore.
- [ ] **Templates**: Plantillas preconfiguradas por industria (Inmobiliaria, Salud, Ecommerce).
- [ ] **Analytics**: Panel de uso de tokens y efectividad de respuestas.
