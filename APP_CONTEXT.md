# 🛸 Contexto de la Aplicación: OVNI Agent v2

## 📌 Descripción General
OVNI Agent v2 es un ecosistema de **Agentes Autónomos Orquestados** diseñado para proporcionar una interfaz de IA avanzada para múltiples organizaciones (`clientId`). El sistema utiliza una arquitectura de grafo de estados para gestionar flujos de conversación complejos, integrando recuperación de conocimiento (RAG), gestión de citas y catálogos de productos.

## 🏗️ Arquitectura Técnica

### 1. Orquestación y Flujo (LangGraph)
El núcleo del agente es un grafo de estados implementado con **LangGraph** que sigue el ciclo de razonamiento **ReAct** (Pensamiento $\rightarrow$ Acción $\rightarrow$ Observación $\rightarrow$ Respuesta).

**Flujo del Grafo:**
`START` $\rightarrow$ `config` (Hidratación del agente) $\rightarrow$ `history_retriever` (Contexto previo) $\rightarrow$ `speech_to_text` (Procesamiento de audio) $\rightarrow$ `agent` (Modelo LLM - Gemini 2.5) $\rightarrow$ `tools` (Ejecución de herramientas, vuelve al `agent`) $\rightarrow$ `text_to_speech` (Síntesis de voz) $\rightarrow$ `save_history` (Persistencia) $\rightarrow$ `END`.

### 2. Stack Tecnológico
- **Backend**: Node.js con Express.
- **IA**: Gemini 2.5 (Flash/Pro) para razonamiento y generación.
- **Orquestación**: LangGraph / LangChain.
- **Base de Datos NoSQL**: Firestore (Metadata, configuraciones, historial, checkpoints).
- **Base de Datos Vectorial**: Pinecone (RAG, búsqueda semántica de productos e historial).
- **Integraciones**: Google Calendar (OAuth 2.0), Resend (Emails), Speech-to-Text/Text-to-Speech.

## 💾 Modelo de Datos

### Firestore (Persistencia Estructurada)
- `admins`: Configuraciones de las organizaciones (`clientId`), horarios comerciales y tokens de Calendar.
- `agents`: Perfiles de IA, instrucciones de sistema, skills habilitadas y vinculación a documentos.
- `agent_metadata`: Estado de flujos activos por sesión (ej. datos recolectados para una cita).
- `checkpoints`: Estado interno del grafo de LangGraph para retomar conversaciones (`thread_id`).
- `history`: Mensajes de conversaciones y resúmenes generados por IA.
- `knowledge_docs` & `knowledge_parts`: Metadata y fragmentos de documentos procesados.
- `products`: Catálogo estructurado de productos.
- `meetings`: Solicitudes de citas pendientes o confirmadas.

### Pinecone (Búsqueda Semántica)
Utiliza namespaces para garantizar el aislamiento de datos:
- `client_{clientId}`: Fragmentos de documentos para RAG.
- `products_client_{clientId}`: Búsqueda semántica de productos.
- `history_{agentId}_{userId}`: Recuperación de mensajes pasados por similitud.
- `document_catalog` & `global_functions`: Descubrimiento global de documentos y herramientas.

## 🛠️ Capacidades Principales (Tools)

### 📚 Recuperación de Conocimiento (RAG Adaptativo)
El sistema no hace prefetch automático. El modelo decide cuándo usar:
- `knowledge_retriever`: Busca en Pinecone y devuelve fragmentos relevantes de documentos.
- `product_catalog`: Consulta el catálogo estructurado de productos en Firestore.
- **Fallback Cruzado**: Si no encuentra datos en productos, busca en documentos y viceversa.

### 📅 Gestión de Citas (`appointment_manager`)
- **Proactividad**: Consulta disponibilidad mediante Google Calendar.
- **Validación Estricta**: Exige Nombre, Email y Teléfono antes de agendar.
- **Flujo de Confirmación**: Muestra un resumen final y requiere confirmación explícita del usuario antes de crear la solicitud.

### 🎙️ Interfaz Multimodal
- Soporta entrada de audio (STT) y salida de voz (TTS).
- Las respuestas de audio están optimizadas para ser breves y naturales.

## 🛡️ Seguridad y Multi-tenancy
- **Aislamiento**: Todos los datos están filtrados por `clientId`.
- **CORS Dinámico**: Permite dominios configurados específicamente para cada administrador.
- **Validación**: Uso de esquemas **Zod** para todas las entradas a las herramientas.