import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
/**
 * Herramienta para gestión de citas y disponibilidad.
 */
export declare const appointmentManagerTool: DynamicStructuredTool<z.ZodObject<{
    action: z.ZodDefault<z.ZodEnum<["check_availability", "check_next_days", "schedule"]>>;
    threadId: z.ZodString;
    date: z.ZodOptional<z.ZodString>;
    time: z.ZodOptional<z.ZodString>;
    userInfo: z.ZodOptional<z.ZodObject<{
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
    topic: z.ZodOptional<z.ZodString>;
    confirmedByUser: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    threadId: string;
    action: "check_availability" | "check_next_days" | "schedule";
    userInfo?: {
        email?: string | undefined;
        name?: string | undefined;
        phone?: string | undefined;
    } | undefined;
    date?: string | undefined;
    time?: string | undefined;
    topic?: string | undefined;
    confirmedByUser?: boolean | undefined;
}, {
    threadId: string;
    userInfo?: {
        email?: string | undefined;
        name?: string | undefined;
        phone?: string | undefined;
    } | undefined;
    date?: string | undefined;
    time?: string | undefined;
    action?: "check_availability" | "check_next_days" | "schedule" | undefined;
    topic?: string | undefined;
    confirmedByUser?: boolean | undefined;
}>, {
    threadId: string;
    action: "check_availability" | "check_next_days" | "schedule";
    userInfo?: {
        email?: string | undefined;
        name?: string | undefined;
        phone?: string | undefined;
    } | undefined;
    date?: string | undefined;
    time?: string | undefined;
    topic?: string | undefined;
    confirmedByUser?: boolean | undefined;
}, {
    threadId: string;
    userInfo?: {
        email?: string | undefined;
        name?: string | undefined;
        phone?: string | undefined;
    } | undefined;
    date?: string | undefined;
    time?: string | undefined;
    action?: "check_availability" | "check_next_days" | "schedule" | undefined;
    topic?: string | undefined;
    confirmedByUser?: boolean | undefined;
}, string>;
