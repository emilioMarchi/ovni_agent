import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
interface ConversationContext {
    userInfo: {
        name?: string;
        email?: string;
        phone?: string;
    };
    businessInfo: {
        rubric?: string;
        localidad?: string;
        proyecto?: string;
    };
}
export declare function getSessionData(threadId: string): ConversationContext;
export declare const contextManagerTool: DynamicStructuredTool<z.ZodObject<{
    action: z.ZodEnum<["save_user", "save_business", "get", "get_summary"]>;
    threadId: z.ZodString;
    userData: z.ZodOptional<z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        email: z.ZodOptional<z.ZodString>;
        phone: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        email?: string | undefined;
        name?: string | undefined;
        phone?: string | undefined;
    }, {
        email?: string | undefined;
        name?: string | undefined;
        phone?: string | undefined;
    }>>;
    businessData: z.ZodOptional<z.ZodObject<{
        rubric: z.ZodOptional<z.ZodString>;
        localidad: z.ZodOptional<z.ZodString>;
        proyecto: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        rubric?: string | undefined;
        localidad?: string | undefined;
        proyecto?: string | undefined;
    }, {
        rubric?: string | undefined;
        localidad?: string | undefined;
        proyecto?: string | undefined;
    }>>;
    field: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    threadId: string;
    action: "get" | "save_user" | "save_business" | "get_summary";
    userData?: {
        email?: string | undefined;
        name?: string | undefined;
        phone?: string | undefined;
    } | undefined;
    businessData?: {
        rubric?: string | undefined;
        localidad?: string | undefined;
        proyecto?: string | undefined;
    } | undefined;
    field?: string | undefined;
}, {
    threadId: string;
    action: "get" | "save_user" | "save_business" | "get_summary";
    userData?: {
        email?: string | undefined;
        name?: string | undefined;
        phone?: string | undefined;
    } | undefined;
    businessData?: {
        rubric?: string | undefined;
        localidad?: string | undefined;
        proyecto?: string | undefined;
    } | undefined;
    field?: string | undefined;
}>, {
    threadId: string;
    action: "get" | "save_user" | "save_business" | "get_summary";
    userData?: {
        email?: string | undefined;
        name?: string | undefined;
        phone?: string | undefined;
    } | undefined;
    businessData?: {
        rubric?: string | undefined;
        localidad?: string | undefined;
        proyecto?: string | undefined;
    } | undefined;
    field?: string | undefined;
}, {
    threadId: string;
    action: "get" | "save_user" | "save_business" | "get_summary";
    userData?: {
        email?: string | undefined;
        name?: string | undefined;
        phone?: string | undefined;
    } | undefined;
    businessData?: {
        rubric?: string | undefined;
        localidad?: string | undefined;
        proyecto?: string | undefined;
    } | undefined;
    field?: string | undefined;
}, string>;
export declare function clearSessionContext(threadId: string): void;
export {};
