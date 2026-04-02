import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
/**
 * Herramienta de análisis documental comparativo.
 *
 * Flujo:
 *  1. Extrae fragmentos del documento objetivo desde Pinecone.
 *  2. Para cada fragmento, busca contexto relevante en la base de conocimiento (RAG).
 *  3. Construye pares [fragmento + contexto teórico] y los envía al modelo para análisis.
 *  4. Genera un reporte consolidado de hallazgos, anomalías o diferencias.
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
