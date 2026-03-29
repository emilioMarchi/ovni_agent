import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
/**
 * Herramienta de Memoria a Largo Plazo (Nivel 3).
 * Busca en el historial semántico de Pinecone para recordar temas de charlas pasadas.
 */
export declare const historyRetrieverTool: DynamicStructuredTool<z.ZodObject<{
    query: z.ZodString;
    userId: z.ZodString;
    agentId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    agentId: string;
    query: string;
    userId: string;
}, {
    agentId: string;
    query: string;
    userId: string;
}>, {
    agentId: string;
    query: string;
    userId: string;
}, {
    agentId: string;
    query: string;
    userId: string;
}, string>;
