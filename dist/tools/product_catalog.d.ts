import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
/**
 * Herramienta para búsqueda inteligente de productos.
 * Combina búsqueda semántica (Pinecone) con búsqueda de texto directo y filtrado por categoría.
 */
export declare const productCatalogTool: DynamicStructuredTool<z.ZodObject<{
    query: z.ZodEffects<z.ZodDefault<z.ZodString>, string, unknown>;
    clientId: z.ZodEffects<z.ZodString, string, unknown>;
    allowedCategories: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    allowedDocIds: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    listAll: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    clientId: string;
    allowedDocIds: string[];
    query: string;
    allowedCategories: string[];
    listAll: boolean;
}, {
    clientId?: unknown;
    allowedDocIds?: string[] | undefined;
    query?: unknown;
    allowedCategories?: string[] | undefined;
    listAll?: boolean | undefined;
}>, {
    clientId: string;
    allowedDocIds: string[];
    query: string;
    allowedCategories: string[];
    listAll: boolean;
}, {
    clientId?: unknown;
    allowedDocIds?: string[] | undefined;
    query?: unknown;
    allowedCategories?: string[] | undefined;
    listAll?: boolean | undefined;
}, string>;
