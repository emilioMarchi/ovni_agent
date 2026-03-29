import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
/**
 * Herramienta para gestionar perfiles de usuario y estados de flujo en Firestore.
 * Permite persistir información de contacto y el progreso de la conversación.
 */
export declare const userProfileManagerTool: DynamicStructuredTool<z.ZodObject<{
    action: z.ZodEnum<["get", "update", "create"]>;
    userId: z.ZodString;
    clientId: z.ZodString;
    data: z.ZodOptional<z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        email: z.ZodOptional<z.ZodString>;
        phone: z.ZodOptional<z.ZodString>;
        flowState: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        flowState?: string | undefined;
        name?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
        metadata?: Record<string, any> | undefined;
    }, {
        flowState?: string | undefined;
        name?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
        metadata?: Record<string, any> | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    clientId: string;
    action: "create" | "get" | "update";
    userId: string;
    data?: {
        flowState?: string | undefined;
        name?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
        metadata?: Record<string, any> | undefined;
    } | undefined;
}, {
    clientId: string;
    action: "create" | "get" | "update";
    userId: string;
    data?: {
        flowState?: string | undefined;
        name?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
        metadata?: Record<string, any> | undefined;
    } | undefined;
}>, {
    clientId: string;
    action: "create" | "get" | "update";
    userId: string;
    data?: {
        flowState?: string | undefined;
        name?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
        metadata?: Record<string, any> | undefined;
    } | undefined;
}, {
    clientId: string;
    action: "create" | "get" | "update";
    userId: string;
    data?: {
        flowState?: string | undefined;
        name?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
        metadata?: Record<string, any> | undefined;
    } | undefined;
}, string>;
