import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import { knowledgeRetrieverTool } from "./knowledge_retriever.js";
const analysisModel = new ChatGoogleGenerativeAI({
    modelName: "gemini-2.5-flash",
    maxOutputTokens: 16384,
    temperature: 0.15,
    apiKey: process.env.GEMINI_API_KEY,
});
/**
 * Herramienta de análisis documental comparativo.
 *
 * Flujo:
 *  1. Resuelve los documentos objetivo (contratos) y de referencia desde Firestore.
 *  2. Usa knowledge_retriever para extraer fragmentos del contrato (misma lógica de búsqueda que funciona en el chat).
 *  3. Usa knowledge_retriever para extraer contexto normativo/legal de los documentos de referencia.
 *  4. Combina ambos y envía al modelo para análisis comparativo.
 *  5. Genera un reporte consolidado de hallazgos, anomalías o diferencias.
 */
export const documentAnalyzerTool = new DynamicStructuredTool({
    name: "document_analyzer",
    description: "Analiza uno o más documentos del cliente buscando anomalías, inconsistencias o puntos relevantes, comparándolos en tiempo real con la base de conocimiento disponible. Úsala cuando el usuario pida analizar contratos, facturas, documentos legales o cualquier archivo cargado.",
    schema: z.object({
        query: z.string().describe("Instrucción de análisis: qué buscar, qué comparar, qué tipo de anomalías detectar."),
        targetDocIds: z.array(z.string()).describe("Nombre o ID del documento específico a analizar. Usa SOLO el nombre que el usuario mencionó. Si el usuario pide analizar TODOS los documentos, pasá el string 'todos'."),
        referenceDocIds: z.array(z.string()).optional().describe("IDs de documentos de referencia. Si no se proporcionan, se usan todos los de tipo 'reference'."),
        clientId: z.string().describe("ID del cliente."),
        allowedDocIds: z.array(z.string()).optional().describe("Lista completa de IDs de documentos permitidos para este agente."),
    }),
    func: async ({ query, targetDocIds, referenceDocIds, clientId, allowedDocIds = [] }) => {
        // ── Validar que la consulta de análisis sea clara y suficiente ──
        const vagueInputs = [
            "analizar", "revisar", "ver", "chequear", "analisis",
            "revisión", "revisión de documento", "documento", "general", "todo", "-", "?"
        ];
        if (!query || query.trim().length < 8 || vagueInputs.some(v => query.trim().toLowerCase() === v)) {
            return "Por favor, especificá con mayor detalle qué aspecto, tema o riesgo querés analizar en el/los documento(s). Ejemplo: 'Buscar cláusulas de rescisión anticipada', 'Comparar tasas de interés', 'Detectar anomalías en fechas de vencimiento', etc.";
        }
        try {
            const { default: admin } = await import("../server/firebase.js");
            const db = admin.firestore();
            // ── PASO 0: Resolver documentos por tipo (contract vs reference) ──
            const allDocsSnap = await db.collection("knowledge_docs")
                .where("clientId", "==", clientId)
                .get();
            const contractDocs = [];
            const referenceOnlyDocIds = [];
            for (const doc of allDocsSnap.docs) {
                const data = doc.data();
                if (data.docType === "contract") {
                    contractDocs.push({
                        id: doc.id,
                        name: (data.filename || doc.id).toLowerCase().replace(/\.[^.]+$/, ""),
                    });
                }
                else {
                    referenceOnlyDocIds.push(doc.id);
                }
            }
            // ── Detectar si el usuario pidió analizar TODOS los contratos ──
            const analyzeAll = targetDocIds.some(t => {
                const tl = t.toLowerCase().trim();
                return tl === "todos" || tl === "all" || tl === "todo" || tl === "todos los documentos"
                    || tl === "todos los contratos";
            });
            let finalTargetIds = [];
            if (analyzeAll) {
                // Analizar todos los contracts del agente
                finalTargetIds = contractDocs
                    .filter(d => allowedDocIds.includes(d.id))
                    .map(d => d.id);
                console.log(`📊 [DOC_ANALYZER] Modo "analizar todos": ${finalTargetIds.length} contratos`);
            }
            else {
                // Resolver cada nombre/ID a un documento específico con fuzzy matching
                for (const tid of targetDocIds) {
                    const tidLower = tid.toLowerCase().trim();
                    // 1. Match exacto por ID
                    const exactById = contractDocs.find(d => d.id === tid);
                    if (exactById) {
                        finalTargetIds.push(exactById.id);
                        continue;
                    }
                    // 2. Match exacto por nombre
                    const exactByName = contractDocs.find(d => d.name === tidLower);
                    if (exactByName) {
                        finalTargetIds.push(exactByName.id);
                        continue;
                    }
                    // 3. Match parcial: el nombre del doc contiene el input o viceversa
                    const partialMatches = contractDocs.filter(d => d.name.includes(tidLower) || tidLower.includes(d.name));
                    if (partialMatches.length === 1) {
                        finalTargetIds.push(partialMatches[0].id);
                        continue;
                    }
                    // 4. Match por palabras clave: todas las palabras del input aparecen en el nombre
                    const inputWords = tidLower.split(/[\s\-_]+/).filter(w => w.length > 2);
                    if (inputWords.length > 0) {
                        const wordMatches = contractDocs.filter(d => inputWords.every(w => d.name.includes(w)));
                        if (wordMatches.length === 1) {
                            finalTargetIds.push(wordMatches[0].id);
                            continue;
                        }
                        // Si hay varias coincidencias parciales, tomar la que más palabras matchea
                        if (wordMatches.length > 1) {
                            finalTargetIds.push(wordMatches[0].id);
                            continue;
                        }
                    }
                    // 5. Match suave: al menos alguna palabra significativa del input aparece en el nombre
                    if (inputWords.length > 0) {
                        const softMatches = contractDocs.filter(d => inputWords.some(w => d.name.includes(w)));
                        if (softMatches.length === 1) {
                            finalTargetIds.push(softMatches[0].id);
                            continue;
                        }
                    }
                    // No se encontró match para este targetDocId — se ignora y se reportará abajo
                    console.log(`📊 [DOC_ANALYZER] No se resolvió target: "${tid}"`);
                }
                // Deduplicar
                finalTargetIds = [...new Set(finalTargetIds)];
            }
            // Si se pidieron docs específicos pero ninguno matcheó → listar los disponibles
            if (finalTargetIds.length === 0 && !analyzeAll) {
                const availableContracts = contractDocs
                    .filter(d => allowedDocIds.includes(d.id))
                    .map(d => `- ${d.name}`)
                    .join("\n");
                return `No pude identificar el documento que mencionás. Estos son los documentos de tipo contrato disponibles:\n\n${availableContracts || "(ninguno cargado)"}\n\nPor favor indicá el nombre del documento que querés analizar.`;
            }
            // Docs de referencia: SOLO tipo reference, nunca contracts
            const finalRefIds = referenceDocIds && referenceDocIds.length > 0
                ? referenceDocIds.filter(id => referenceOnlyDocIds.includes(id))
                : referenceOnlyDocIds.filter(id => allowedDocIds.includes(id));
            console.log(`\n📊 [DOC_ANALYZER] ========== INICIO ANÁLISIS =========`);
            console.log(`📊 [DOC_ANALYZER] Query: "${query}"`);
            console.log(`📊 [DOC_ANALYZER] Target IDs originales: ${targetDocIds.join(", ")}`);
            console.log(`📊 [DOC_ANALYZER] Target IDs resueltos: ${finalTargetIds.join(", ")}`);
            console.log(`📊 [DOC_ANALYZER] Reference IDs: ${finalRefIds.join(", ")}`);
            console.log(`📊 [DOC_ANALYZER] AllowedDocIds: ${allowedDocIds.join(", ")}`);
            if (finalTargetIds.length === 0) {
                return "No se pudo identificar el/los documento(s) a analizar. Indicá el nombre del documento objetivo o verificá que esté cargado como tipo 'contract'.";
            }
            // ── PASO 1: Obtener fragmentos del contrato usando knowledge_retriever ──
            console.log(`📊 [DOC_ANALYZER] PASO 1: Buscando fragmentos del contrato con knowledge_retriever...`);
            const contractResult = await knowledgeRetrieverTool.func({
                query,
                clientId,
                allowedDocIds: finalTargetIds,
            });
            const contractText = typeof contractResult === "string" ? contractResult : String(contractResult);
            console.log(`📊 [DOC_ANALYZER] Contrato: ${contractText.length} caracteres recuperados`);
            if (!contractText || contractText.includes("no tiene documentos") || contractText.includes("No se encontró información")) {
                return "No se encontraron fragmentos en los documentos objetivo. Verificá que los documentos estén correctamente cargados e indexados.";
            }
            // ── PASO 2: Obtener contexto de referencia usando knowledge_retriever ──
            let referenceText = "(sin documentos de referencia disponibles)";
            if (finalRefIds.length > 0) {
                console.log(`📊 [DOC_ANALYZER] PASO 2: Buscando contexto de referencia con knowledge_retriever...`);
                const refResult = await knowledgeRetrieverTool.func({
                    query,
                    clientId,
                    allowedDocIds: finalRefIds,
                });
                const refStr = typeof refResult === "string" ? refResult : String(refResult);
                if (refStr && !refStr.includes("no tiene documentos") && !refStr.includes("No se encontró información")) {
                    referenceText = refStr;
                }
                console.log(`📊 [DOC_ANALYZER] Referencia: ${referenceText.length} caracteres recuperados`);
            }
            else {
                console.log(`📊 [DOC_ANALYZER] Sin docs de referencia asignados, análisis solo del contrato.`);
            }
            // ── PASO 3: Enviar al modelo para análisis comparativo ──
            console.log(`📊 [DOC_ANALYZER] PASO 3: Enviando a Gemini para análisis comparativo...`);
            const analysisPrompt = `Sos un auditor legal y analista documental senior con experiencia en derecho societario, contractual y regulatorio. El usuario te pidió: "${query}"

A continuación tenés dos bloques de información:

1. DOCUMENTO A ANALIZAR (contrato/documento del cliente):
${contractText}

2. BASE NORMATIVA Y LEGAL DE REFERENCIA:
${referenceText}

IMPORTANTE: Si la consulta del usuario no es suficientemente clara o falta información para hacer el análisis correctamente, respondé pidiendo al usuario que detalle mejor qué aspecto, tema o riesgo desea analizar.

Tu objetivo es generar un REPORTE PROFESIONAL DE AUDITORÍA DOCUMENTAL. El reporte debe ser exhaustivo, detallado y accionable.

ESTRUCTURA OBLIGATORIA DEL REPORTE:

## 1. DATOS DEL ANÁLISIS
- Documento analizado (nombre/tipo)
- Normativa de referencia utilizada
- Alcance del análisis según la consulta del usuario

## 2. HALLAZGOS Y ANOMALÍAS DETECTADAS
Para CADA anomalía encontrada, incluí obligatoriamente:

### Anomalía #N: [Título descriptivo]
- **Ubicación en el documento**: Citá textualmente la cláusula, artículo o fragmento exacto del documento que presenta el problema.
- **Tipo de anomalía**: Clasificala (ej: omisión legal, contradicción normativa, cláusula abusiva, vicio formal, inconsistencia interna, riesgo contractual, etc.).
- **Gravedad**: Crítica / Alta / Media / Baja.
- **Norma vulnerada**: Citá el artículo, sección o norma específica de la base de referencia que se estaría incumpliendo. Transcribí el texto relevante de la norma.
- **Análisis detallado**: Explicá en profundidad por qué esto constituye una anomalía, qué riesgo genera y qué consecuencias legales o prácticas podría tener.
- **Corrección sugerida**: Proporcioná una redacción alternativa o las acciones específicas que deben tomarse para corregir la anomalía y cumplir con la normativa vigente. Sé concreto y accionable.

## 3. ASPECTOS CONFORMES
Mencioná brevemente los aspectos del documento que SÍ cumplen correctamente con la normativa de referencia.

## 4. RESUMEN EJECUTIVO
- Total de anomalías detectadas (por gravedad)
- Los 3 hallazgos más críticos resumidos en una oración cada uno
- Evaluación general del documento: si es apto, requiere correcciones menores, o tiene problemas graves que deben resolverse antes de su validez/firma.

## 5. RECOMENDACIONES FINALES
Acciones prioritarias ordenadas de mayor a menor urgencia para regularizar el documento.

REGLAS:
- NO omitas anomalías. Analizá CADA aspecto del documento contra la referencia disponible.
- NO seas vago: citá textualmente tanto del documento como de la norma.
- Si no tenés suficiente contexto de referencia para un aspecto, indicalo explícitamente pero igualmente señalá el riesgo potencial.
- El reporte debe ser útil para un abogado, contador o directivo que necesite tomar acción inmediata.

REPORTE DE AUDITORÍA DOCUMENTAL:`;
            const response = await analysisModel.invoke([new HumanMessage(analysisPrompt)]);
            const report = typeof response.content === "string" ? response.content : String(response.content);
            console.log(`📊 [DOC_ANALYZER] Reporte generado: ${report.length} caracteres`);
            console.log(`📊 [DOC_ANALYZER] ========== FIN ANÁLISIS =========\n`);
            return report;
        }
        catch (error) {
            console.error("❌ [DOC_ANALYZER] Error:", error);
            return "Hubo un error al analizar los documentos. Verificá que los documentos estén correctamente cargados e intentá de nuevo.";
        }
    },
});
//# sourceMappingURL=document_analyzer.js.map