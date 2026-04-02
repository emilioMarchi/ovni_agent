import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { HumanMessage } from "@langchain/core/messages";
const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
});
const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "gemini-embedding-001",
    taskType: TaskType.RETRIEVAL_QUERY,
    apiKey: process.env.GEMINI_API_KEY,
});
const analysisModel = new ChatGoogleGenerativeAI({
    modelName: "gemini-2.5-flash",
    maxOutputTokens: 4096,
    temperature: 0.2,
    apiKey: process.env.GEMINI_API_KEY,
});
/**
 * Herramienta de análisis documental comparativo.
 *
 * Flujo:
 *  1. Extrae fragmentos del documento objetivo desde Pinecone.
 *  2. Para cada fragmento, busca contexto relevante en la base de conocimiento (RAG).
 *  3. Construye pares [fragmento + contexto teórico] y los envía al modelo para análisis.
 *  4. Genera un reporte consolidado de hallazgos, anomalías o diferencias.
 */
export const documentAnalyzerTool = new DynamicStructuredTool({
    name: "document_analyzer",
    description: "Analiza uno o más documentos del cliente buscando anomalías, inconsistencias o puntos relevantes, comparándolos en tiempo real con la base de conocimiento disponible. Úsala cuando el usuario pida analizar contratos, facturas, documentos legales o cualquier archivo cargado.",
    schema: z.object({
        query: z.string().describe("Instrucción de análisis: qué buscar, qué comparar, qué tipo de anomalías detectar."),
        targetDocIds: z.array(z.string()).describe("IDs de los documentos a analizar."),
        referenceDocIds: z.array(z.string()).optional().describe("IDs de documentos de referencia (base de conocimiento). Si no se proporcionan, se usan todos los allowedDocIds."),
        clientId: z.string().describe("ID del cliente."),
        allowedDocIds: z.array(z.string()).optional().describe("Lista completa de IDs de documentos permitidos para este agente."),
    }),
    func: async ({ query, targetDocIds, referenceDocIds, clientId, allowedDocIds = [] }) => {
        try {
            const index = pinecone.index("chatbot-knowledge");
            const namespace = `client_${clientId}`;
            console.log(`\n📊 [DOC_ANALYZER] ========== INICIO ANÁLISIS =========`);
            console.log(`📊 [DOC_ANALYZER] Query: "${query}"`);
            console.log(`📊 [DOC_ANALYZER] Docs objetivo: ${targetDocIds.join(", ")}`);
            console.log(`📊 [DOC_ANALYZER] Docs referencia: ${(referenceDocIds || allowedDocIds).join(", ")}`);
            // ── PASO 1: Extraer fragmentos del documento objetivo ──
            // Usamos un vector de consulta genérico para traer todos los fragmentos del doc
            const queryVector = await embeddings.embedQuery(query);
            const targetFragments = [];
            for (const docId of targetDocIds) {
                const result = await index.namespace(namespace).query({
                    vector: queryVector,
                    topK: 15,
                    filter: { docId: { "$eq": docId } },
                    includeMetadata: true,
                });
                const fragments = (result.matches || []).map((m) => ({
                    text: m.metadata?.text || "",
                    section: m.metadata?.section_title || m.metadata?.description || "",
                    filename: m.metadata?.filename || "",
                    score: m.score || 0,
                    docId,
                }));
                console.log(`📊 [DOC_ANALYZER] Doc ${docId}: ${fragments.length} fragmentos extraídos`);
                targetFragments.push(...fragments);
            }
            if (targetFragments.length === 0) {
                return "No se encontraron fragmentos en los documentos objetivo. Verificá que los documentos estén correctamente cargados.";
            }
            // Ordenar por relevancia
            targetFragments.sort((a, b) => b.score - a.score);
            const topFragments = targetFragments.slice(0, 12);
            // ── PASO 2: Para cada fragmento, buscar contexto teórico en la base de conocimiento ──
            const refDocIds = referenceDocIds && referenceDocIds.length > 0
                ? referenceDocIds
                : allowedDocIds.filter((id) => !targetDocIds.includes(id));
            const analysisBlocks = [];
            for (const frag of topFragments) {
                let contextText = "";
                if (refDocIds.length > 0) {
                    // Generar embedding del fragmento para buscar contexto relevante
                    const fragVector = await embeddings.embedQuery(frag.text.slice(0, 500));
                    const refResult = await index.namespace(namespace).query({
                        vector: fragVector,
                        topK: 3,
                        filter: {
                            docId: { "$in": refDocIds },
                        },
                        includeMetadata: true,
                    });
                    contextText = (refResult.matches || [])
                        .filter((m) => (m.score || 0) >= 0.3)
                        .map((m) => `[REF: ${m.metadata?.filename}] ${m.metadata?.text}`)
                        .join("\n\n");
                }
                analysisBlocks.push({
                    fragment: frag.text,
                    section: frag.section,
                    filename: frag.filename,
                    context: contextText || "(sin contexto de referencia disponible)",
                });
            }
            console.log(`📊 [DOC_ANALYZER] ${analysisBlocks.length} bloques de análisis preparados`);
            // ── PASO 3: Enviar al modelo para análisis comparativo ──
            const blocksText = analysisBlocks
                .map((b, i) => {
                return `--- BLOQUE ${i + 1} (${b.filename} / ${b.section}) ---
FRAGMENTO DEL DOCUMENTO:
${b.fragment}

CONTEXTO DE REFERENCIA:
${b.context}`;
            })
                .join("\n\n");
            const analysisPrompt = `Sos un analista experto. El usuario te pidió: "${query}"

A continuación tenés bloques de análisis. Cada bloque contiene:
- Un FRAGMENTO de un documento que se quiere analizar.
- CONTEXTO DE REFERENCIA extraído de la base de conocimiento para comparar.

Tu tarea:
1. Analizar cada fragmento en relación al contexto de referencia.
2. Detectar anomalías, inconsistencias, riesgos, cláusulas inusuales o puntos que requieran atención.
3. Generar un REPORTE CONSOLIDADO con los hallazgos, organizados por sección.
4. Si no encontrás anomalías en una sección, mencionalo brevemente.
5. Sé específico: citá el fragmento y la referencia cuando encuentres algo.

${blocksText}

REPORTE DE ANÁLISIS:`;
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