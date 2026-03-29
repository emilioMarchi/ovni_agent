# Estructura de Bases de Datos — OVNI Agent v2

> Documentación generada el 29/03/2026 inspeccionando directamente Firestore y Pinecone en producción.

---

## 🔥 FIRESTORE

**11 colecciones** en total.

---

### 1. `admins` (2 docs)

Organizaciones/clientes dueños de agentes. El doc ID es el `clientId` (ej: `org_2d8f74a1-...`).

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | string | Mismo que el doc ID |
| `name` | string | Nombre de la organización |
| `email` | string | Email del admin |
| `passwordHash` | string | Hash bcrypt del password |
| `apiKey` | string | API key del admin (`sk_...`) |
| `clientId` | string | Mismo que doc ID |
| `senderEmail` | string | Email remitente para comunicaciones |
| `businessName` | string | Nombre del negocio |
| `businessContext` | string | Contexto de negocio (texto libre) |
| `businessHours` | object | Horarios por día `{ lunes: { ranges: [{start, end}], enabled } }` |
| `systemInstruction` | string | Instrucción de sistema por defecto |
| `googleCalendar` | object | `{ connected, calendarId, connectedAt, tokens: { refresh_token, ... } }` |
| `createdAt` | string | ISO timestamp |
| `updatedAt` | string | ISO timestamp |

---

### 2. `agents` (2 docs)

Configuración de cada agente de IA. Doc ID: `agent_{uuid}`.

| Campo | Tipo | Descripción |
|---|---|---|
| `clientId` | string | Ref al admin/org dueño |
| `agentClientId` | string | Mismo que clientId |
| `name` | string | Nombre del agente (ej: "Alejandra") |
| `description` | string | Descripción del agente |
| `type` | string | Tipo (ej: "general") |
| `profile` | string | Perfil (ej: "general") |
| `apiKey` | string | API key del agente (`ag_...`) |
| `isActive` | boolean | Si está activo |
| `active` | boolean | Duplicado de isActive |
| `skills` | array\<string\> | Skills habilitadas: `["knowledge", "sales", "history", "calendar"]` |
| `functions` | array\<string\> | Tools habilitadas: `["knowledge_retriever", "product_catalog", "appointment_manager", "history_retriever"]` |
| `knowledgeDocs` | array\<string\> | IDs de docs en `knowledge_docs` vinculados |
| `systemInstruction` | string | System prompt personalizado |
| `businessContext` | string | Contexto de negocio |
| `temperature` | number | Temperatura del modelo (0.7) |
| `welcomeMessage` | string | Mensaje de bienvenida |
| `allowedDomains` | array\<string\> | Dominios permitidos para el widget |
| `widgetConfig` | object | `{ primaryColor, position, customIcon, greeting }` |
| `config` | object | `{ temperature, maxTokens }` |
| `version` | string | Versión (ej: "2.0.0") |
| `createdAt` | string | ISO timestamp |
| `updatedAt` | string | ISO timestamp |

---

### 3. `agent_metadata` (57 docs)

Metadata de sesión por agente+usuario. Doc ID: `meta_{agentId}_{userId}`.

| Campo | Tipo | Descripción |
|---|---|---|
| `agentId` | string | Ref al agente |
| `clientId` | string | Ref al admin/org |
| `userId` | string | ID del usuario de la conversación |
| `metadata` | object | Estado de flujos activos (JSON stringificado): `{ meeting_flow_active, meeting_data, active_flows_registry, flow_meeting_data }` |
| `updatedAt` | string | ISO timestamp |

---

### 4. `checkpoints` (4 docs)

Checkpoints de LangGraph para persistencia de estado del grafo. Doc ID: `{thread_id}` o `session_{timestamp}`.

| Campo | Tipo | Descripción |
|---|---|---|
| `thread_id` | string | ID del hilo de conversación |
| `checkpoint` | string | JSON stringificado del estado completo del grafo LangGraph |
| `metadata` | string | JSON stringificado: `{ source, writes, step, parents }` |
| `updatedAt` | Timestamp | Firestore server timestamp |

---

### 5. `history` (16 docs)

Historial de conversaciones. Doc ID: `conv_{agentId}_{userId}_{threadId}`.

| Campo | Tipo | Descripción |
|---|---|---|
| `clientId` | string | Ref al admin/org |
| `agentId` | string | Ref al agente |
| `userId` | string | ID del usuario ("anonymous" si no identificado) |
| `threadId` | string | UUID del hilo |
| `userName` | string | Nombre del usuario (opcional) |
| `messages` | array\<object\> | `[{ role: "user"|"assistant", content: string, timestamp: ISO }]` |
| `summary` | string | Resumen generado al cerrar sesión (opcional) |
| `classification` | object | Clasificación de la sesión generada por AI (opcional) |
| `lastUpdate` | Timestamp | Firestore server timestamp |
| `endedAt` | Timestamp | Firestore server timestamp (cuando se cierra sesión) |

---

### 6. `knowledge_docs` (9 docs)

Metadata de documentos de conocimiento ingestados. Doc ID: auto-generado por Firestore o custom.

| Campo | Tipo | Descripción |
|---|---|---|
| `clientId` | string | Ref al admin/org dueño |
| `filename` | string | Nombre original del archivo |
| `description` | string | Descripción generada por AI |
| `keywords` | array\<string\> | Keywords extraídas por AI |
| `status` | string | Estado (ej: "processed") |
| `partsCount` | number | Cantidad de fragmentos generados |
| `createdAt` | string | ISO timestamp |
| `updatedAt` | string | ISO timestamp |

---

### 7. `knowledge_parts` (60 docs)

Fragmentos/chunks de documentos de conocimiento. Doc ID: auto-generado o `{docId}_part{i}`.

| Campo | Tipo | Descripción |
|---|---|---|
| `docId` | string | Ref al doc padre en `knowledge_docs` |
| `clientId` | string | Ref al admin/org |
| `filename` | string | Nombre del archivo original |
| `text` | string | Texto del fragmento |
| `description` | string | Resumen/descripción del fragmento |
| `keywords` | array\<string\> | Keywords del fragmento |
| `type` | string | Tipo: "chunk" o "paragraph" |
| `partIndex` | number | Índice del fragmento dentro del doc |
| `createdAt` | string | ISO timestamp |

---

### 8. `meetings` (3 docs)

Reuniones/citas agendadas. Doc ID: auto-generado por Firestore.

| Campo | Tipo | Descripción |
|---|---|---|
| `clientId` | string | Ref al admin/org |
| `date` | string | Fecha "YYYY-MM-DD" |
| `time` | string | Hora "HH:mm" |
| `customerName` | string | Nombre del cliente |
| `customerEmail` | string | Email del cliente |
| `customerPhone` | string | Teléfono del cliente |
| `topic` | string | Tema de la reunión |
| `status` | string | Estado: "pending", etc. |
| `createdAt` | Timestamp | Firestore server timestamp |

---

### 9. `oauth_temp` (2 docs)

Tokens temporales para flujo OAuth. Doc ID: UUID.

| Campo | Tipo | Descripción |
|---|---|---|
| `clientId` | string | Ref al admin/org |
| `type` | string | Tipo de OAuth (ej: "google-calendar") |
| `createdAt` | string | ISO timestamp |

---

### 10. `products` (115 docs)

Catálogo de productos. Doc ID: auto-generado por Firestore.

| Campo | Tipo | Descripción |
|---|---|---|
| `agentId` | string | Ref al agente dueño |
| `nombre` | string | Nombre del producto |
| `descripcion` | string | Descripción del producto |
| `precio` | number | Precio (USD) |
| `categoria` | string | Categoría (ej: "Abrigos", "Calzado", "Accesorios") |
| `sku` | string | SKU del producto |
| `stock` | number | Unidades en stock |
| `imagen` | string | URL de imagen (puede estar vacío) |
| `marca` | string | Marca (puede estar vacío) |
| `atributos` | object | Atributos custom: `{ Material, Clima_Ideal, Sustentabilidad, ... }` |
| `createdAt` | string | ISO timestamp |
| `updatedAt` | string | ISO timestamp |

---

### 11. `usage_logs` (539 docs)

Logs de uso/analytics por interacción. Doc ID: auto-generado.

| Campo | Tipo | Descripción |
|---|---|---|
| `agentId` | string | Ref al agente |
| `clientId` | string | Ref al admin/org |
| `userId` | string | ID del usuario |
| `conversationId` | object | ID de la conversación |
| `timestamp` | string | ISO timestamp |
| `status` | string | "success" o "error" |
| `metrics` | object | `{ responseTime, tokensUsed, promptTokens, completionTokens, embeddingCalls, totalTokens, estimatedCost, costBreakdown }` |
| `trace` | object | `{ thought, intent, tools, queue, safetyCheck, startMeetingFlow }` |
| `rag` | object | Info del RAG: `{ documentsFound, query, documents[] }` |
| `toolsDiscovery` | object | `{ totalMatched, tools[], groups[], reason }` |
| `ragContext` | object | Contexto RAG utilizado |
| `functions` | array | Funciones ejecutadas: `[{ name, params }]` |
| `embeddings` | object | `{ queryLength, callCount, dimension }` |
| `content` | object | `{ userMessage, userMessageLength, botResponse }` |
| `debug` | object | Info de debug |
| `error` | object | Info de error (si aplica) |

---

## 🌲 PINECONE

### Index: `chatbot-knowledge`

| Propiedad | Valor |
|---|---|
| **Host** | `chatbot-knowledge-ltfzitu.svc.aped-4627-b74a.pinecone.io` |
| **Dimensiones** | 3072 |
| **Métrica** | cosine |
| **Total vectores** | 116 |
| **Estado** | Ready |

---

### Namespaces (19 en total)

#### Tipo 1: Knowledge Base por cliente — `client_{clientId}`

Contiene vectores de fragmentos de documentos de conocimiento (RAG).

| Namespace | Vectores | Descripción |
|---|---|---|
| `client_org_2d8f74a1-b9c5-4e2a-bb6d-f492a8e310d5` | 31 | OVNI Studio (producción) |
| `client_org_or09zav4b` | 15 | Test (botánica) |
| `client_org_botanic_test` | 3 | Test botánica PDF |
| `client_org_test_ingestion` | 3 | Test ingesta |
| `client_test-client` | 16 | Test client |

**Metadata de cada vector:**
| Campo | Ejemplo |
|---|---|
| `clientId` | `"org_2d8f74a1-..."` |
| `docId` | `"eIe2n5AC9JSSM0HpKlbF"` |
| `filename` | `"test-large-knowledge.json"` |
| `description` | Resumen del fragmento |
| `text` | Texto del fragmento |
| `idx` | Índice numérico |
| `keywords` | Keywords separadas por coma |

**Vector ID format:** `part_{docId}_{index}` o `{docId}_part{index}`

---

#### Tipo 2: Historial por agente+usuario — `history_{agentId}_{userId}`

Contiene vectores de mensajes de usuario para búsqueda semántica en historial.

| Namespace | Vectores |
|---|---|
| `history_agent_f2c43c56-..._test_user_iken1r4tt` | 2 |
| `history_agent_f2c43c56-..._web_user_xcspolncw` | 2 |
| `history_agent_f2c43c56-..._web_user_9weo17lka` | 2 |
| `history_agent_f2c43c56-..._user_oksdah9az` | 1 |
| `history_agent_f2c43c56-..._user_new_doc_test_123` | 1 |
| `history_agent_15508fb5-..._test_user_tcak5tj7k` | 2 |
| `history_agent_15508fb5-..._test_user_iken1r4tt` | 1 |
| `history_agent_15508fb5-..._test_user_st95ixfiy` | 1 |
| `history_agent_15508fb5-..._test_user_gmm56jx5u` | 1 |
| `history_agent_15508fb5-..._test_user_hbodjcl4o` | 2 |
| `history_agent_15508fb5-..._test_user_9h8g4k3n8` | 1 |
| `history_agent_36263ce8-..._test_user_iken1r4tt` | 2 |

**Metadata de cada vector:**
| Campo | Ejemplo |
|---|---|
| `role` | `"user"` |
| `sessionId` | `"test_interface_session"` |
| `text` | Texto del mensaje |
| `timestamp` | ISO timestamp |

**Vector ID format:** `msg_{timestamp}`

---

#### Tipo 3: Catálogo de productos — `products_client_{clientId}`

Vectores de productos para búsqueda semántica en el catálogo.

| Namespace | Vectores |
|---|---|
| `products_client_org_2d8f74a1-b9c5-4e2a-bb6d-f492a8e310d5` | 14 |

**Metadata de cada vector:**
| Campo | Ejemplo |
|---|---|
| `nombre` | `"Medias Aero-Walk"` |
| `categoria` | `"Accesorios"` |
| `clientId` | `"org_2d8f74a1-..."` |
| `precio` | `15` |

**Vector ID format:** ID del documento Firestore de `products`.

---

#### Tipo 4: Catálogo de documentos — `document_catalog`

Índice global de documentos de conocimiento para discovery.

| Namespace | Vectores |
|---|---|
| `document_catalog` | 8 |

**Metadata de cada vector:**
| Campo | Ejemplo |
|---|---|
| `clientId` | `"org_2d8f74a1-..."` |
| `docId` | `"VFBwUALUnn9o4LUQ5UoI"` |
| `filename` | `"data.json"` |

**Vector ID format:** ID del `knowledge_docs`.

---

#### Tipo 5: Functions discovery — `global_functions` y `function_groups`

Vectores de herramientas/funciones disponibles para auto-descubrimiento.

| Namespace | Vectores | Contenido |
|---|---|---|
| `global_functions` | 4 | Funciones individuales (ej: `search_products`) |
| `function_groups` | 4 | Grupos de funciones (ej: `LOGISTICA_ENTREGAS`) |

**Metadata (global_functions):**
| Campo | Ejemplo |
|---|---|
| `name` | `"search_products"` |
| `group` | `"COMERCIAL_VENTAS"` |
| `type` | `"function"` |

**Metadata (function_groups):**
| Campo | Ejemplo |
|---|---|
| `type` | `"group"` |

**Vector ID format:** Nombre de la función o del grupo.
