import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
/**
 * Herramienta para búsqueda semántica en la base de conocimientos del cliente.
 * Implementa la lógica de búsqueda jerárquica: Catálogo -> Fragmentos.
 */
export declare const knowledgeRetrieverTool: DynamicStructuredTool<z.ZodObject<{
    query: z.ZodString;
    clientId: z.ZodString;
    allowedDocIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    clientId: string;
    query: string;
    allowedDocIds?: string[] | undefined;
}, {
    clientId: string;
    query: string;
    allowedDocIds?: string[] | undefined;
}>, {
    clientId: string;
    query: string;
    allowedDocIds?: string[] | undefined;
}, {
    clientId: string;
    query: string;
    allowedDocIds?: string[] | undefined;
}, string>;
