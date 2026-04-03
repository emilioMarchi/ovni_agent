import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
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
export declare const documentAnalyzerTool: DynamicStructuredTool<z.ZodObject<{
    query: z.ZodString;
    targetDocIds: z.ZodArray<z.ZodString, "many">;
    referenceDocIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    clientId: z.ZodString;
    allowedDocIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    clientId: string;
    query: string;
    targetDocIds: string[];
    allowedDocIds?: string[] | undefined;
    referenceDocIds?: string[] | undefined;
}, {
    clientId: string;
    query: string;
    targetDocIds: string[];
    allowedDocIds?: string[] | undefined;
    referenceDocIds?: string[] | undefined;
}>, {
    clientId: string;
    query: string;
    targetDocIds: string[];
    allowedDocIds?: string[] | undefined;
    referenceDocIds?: string[] | undefined;
}, {
    clientId: string;
    query: string;
    targetDocIds: string[];
    allowedDocIds?: string[] | undefined;
    referenceDocIds?: string[] | undefined;
}, string>;
