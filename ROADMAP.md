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
- [x] Preconfirmación obligatoria de datos antes de crear solicitudes de reunión.
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

### 9.1: Robustez de Ingesta para Documentos Grandes (30/03/2026)
- [x] **Reparación de JSON**: Parser resiliente (`repairAndParseJSON`) que intenta cerrar JSONs truncados de Gemini y extrae objetos parciales por regex como fallback.
- [x] **Retry Automático**: Cada lote de Gemini que falla se reintenta una vez. Delay inteligente: 15s en rate limit (429), 3s en otros errores.
- [x] **Delay entre Lotes**: 2s de pausa entre llamadas a Gemini para evitar 429 Too Many Requests.
- [x] **Truncado de Metadata Pinecone**: `text` en metadata limitado a 8KB para respetar el límite de 40KB/vector de Pinecone. El texto completo queda en Firestore.
- [x] **Reporte de Procesamiento**: Al finalizar, se genera y persiste en Firestore un `processingReport` con: lotes OK/retry/fallidos, desglose por lote (rango de chars, fragmentos), preview del contenido perdido.
- [x] **Cancelación de Procesamiento**: Endpoint `POST /api/documents/:id/cancel` con AbortSignal para interrumpir el loop de lotes. Limpia datos parciales de Firestore y Pinecone.
- [x] **UI de Progreso Mejorada**: Spinner animado, barra de progreso con pulso, botón de cancelar, y polling optimizado (solo refresca lista al terminar).
- [x] **Logs Limpios**: Eliminados logs repetitivos de polling GET en el servidor.

---

## ✅ Fase 10: Historial y Clasificación de Sesiones - COMPLETADO
- [x] **Endpoints de Sesiones**: `GET /api/chat/sessions` y `GET /api/chat/sessions/:threadId`
- [x] **Análisis con Gemini**: Resumen automático, clasificación (lead/conversation/support), nivel de interés, intenciones, temas, sentimiento
- [x] **Persistencia de Sesiones**: localStorage en widget para retomar conversaciones

---

## ✅ Fase 10.5: Optimización Conversacional y Audio - COMPLETADO
- [x] **RAG Bajo Demanda**: Eliminado el prefetch automático; el modelo decide cuándo consultar `knowledge_retriever`.
- [x] **Fast Path**: Inputs simples mantienen contexto mínimo y evitan procesos previos costosos.
- [x] **Fallback Cruzado**: `product_catalog` y `knowledge_retriever` se complementan antes de responder que no hay información.
- [x] **TTS Consistente**: Voz estabilizada, horarios hablados en formato natural y respuestas verbales resumidas.
- [x] **Widget Dual Audio/Texto**: Respuestas de audio del agente pueden desplegar su texto con un botón `Ver texto`.

---


## ✅ Fase 11: Fixes RAG y Document Analyzer (Abril 2026)
- [x] **document_analyzer**: Ahora solo analiza el documento pedido, nunca todos los contracts. Fuzzy matching robusto por nombre, ID y palabras clave.
- [x] **Scope por docId**: El RAG y el análisis solo usan los documentos permitidos, nunca el universo completo.
- [x] **Organización de archivos**: Todos los .txt y documentos de texto movidos a carpeta `documentos`.
- [x] **Preparación para carpetas RAG**: Arquitectura lista para agregar scope por carpeta sin romper compatibilidad.

## 🚀 Fase 12: Carpetas y Scope RAG
- [ ] **Carpetas en Firestore**: Nueva colección `knowledge_folders` y metadata de carpeta en `knowledge_docs` y Pinecone.
- [ ] **Scope por carpeta**: Resolver allowedDocIds a partir de carpetas seleccionadas por agente, flujo o usuario.
- [ ] **UI Admin**: Selector de carpetas y subcarpetas en la configuración de agentes y documentos.
- [ ] **Compatibilidad**: Mantener knowledgeDocs para agentes legacy.
- [ ] **Optimización Pinecone**: Replicar folderId/folderAncestors en metadata para filtrar directo por carpeta.

## 🚀 Fase 13: Tool Intelligence (Tool RAG)
- [ ] **Tool RAG**: Indexar descripciones de herramientas en Pinecone (`tool_catalog`).
- [ ] **Detector de Intención**: Nodo previo al modelo que selecciona dinámicamente las 3-5 herramientas más relevantes.
- [ ] **Búsqueda Semántica de Funciones**: Consultar Pinecone para resolver funciones/capacidades relevantes en lugar de depender solo de mapeos estáticos y routing manual.
- [ ] **Sincronización de Catálogo de Funciones**: Alinear `global_functions` y `function_groups` de Pinecone con las tools y funciones reales de la app, eliminando entradas legacy o huérfanas.
- [ ] **Búsqueda Semántica de Productos**: Indexar catálogo en Pinecone (`products_<clientId>`) y recuperar candidatos por similitud vectorial antes de hidratar detalles desde Firestore o documentos.

---

## 🕒 Futuro: Optimizaciones
- [x] **Fragmentación Semántica**: Gemini 2.5 Flash divide documentos en secciones lógicas (artículos, cláusulas, párrafos temáticos) en lotes de 100K chars.
- [x] **Embeddings Asimétricos**: Corregido TaskType a `RETRIEVAL_DOCUMENT` para ingesta y `RETRIEVAL_QUERY` para búsqueda (modelo asimétrico de Google).
- [x] **Prompt de Chunking Optimizado**: Fragmentos autosuficientes, ítems de listas como fragmentos individuales, texto original exacto sin modificar, `section_title` jerárquico, 5-10 keywords con sinónimos.
- [x] **Embedding Enriquecido**: Texto de embedding incluye contexto documental (`[Documento: X] [Sección: Y]`) + summary + keywords para mejor matching vectorial, sin alterar el texto almacenado.
- [x] **Metadata `section_title`**: Navegación jerárquica en Pinecone y Firestore (ej: "Productos > Agente Cognitivo"). Retriever retrocompatible con documentos sin este campo.
- [ ] **Builder de Workflows**: Configurar flujos de estados por agente desde Firestore.
- [ ] **Templates**: Plantillas preconfiguradas por industria.
- [ ] **Analytics**: Panel de uso de tokens y efectividad de respuestas.
- [ ] **Templates**: Plantillas preconfiguradas por industria (Inmobiliaria, Salud, Ecommerce).
