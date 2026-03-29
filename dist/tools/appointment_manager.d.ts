import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
/**
 * Herramienta para gestión de citas y disponibilidad.
 */
export declare const appointmentManagerTool: DynamicStructuredTool<z.ZodObject<{
    action: z.ZodDefault<z.ZodEnum<["check_availability", "check_next_days", "schedule"]>>;
    clientId: z.ZodString;
    threadId: z.ZodOptional<z.ZodString>;
    date: z.ZodOptional<z.ZodString>;
    time: z.ZodOptional<z.ZodString>;
    userInfo: z.ZodOptional<z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        email: z.ZodOptional<z.ZodString>;
        phone: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
    }, {
        name?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
    }>>;
    topic: z.ZodOptional<z.ZodString>;
    confirmedByUser: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    clientId: string;
    action: "check_availability" | "check_next_days" | "schedule";
    userInfo?: {
        name?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
    } | undefined;
    threadId?: string | undefined;
    date?: string | undefined;
    time?: string | undefined;
    topic?: string | undefined;
    confirmedByUser?: boolean | undefined;
}, {
    clientId: string;
    userInfo?: {
        name?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
    } | undefined;
    threadId?: string | undefined;
    date?: string | undefined;
    time?: string | undefined;
    action?: "check_availability" | "check_next_days" | "schedule" | undefined;
    topic?: string | undefined;
    confirmedByUser?: boolean | undefined;
}>, {
    clientId: string;
    action: "check_availability" | "check_next_days" | "schedule";
    userInfo?: {
        name?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
    } | undefined;
    threadId?: string | undefined;
    date?: string | undefined;
    time?: string | undefined;
    topic?: string | undefined;
    confirmedByUser?: boolean | undefined;
}, {
    clientId: string;
    userInfo?: {
        name?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
    } | undefined;
    threadId?: string | undefined;
    date?: string | undefined;
    time?: string | undefined;
    action?: "check_availability" | "check_next_days" | "schedule" | undefined;
    topic?: string | undefined;
    confirmedByUser?: boolean | undefined;
}, string>;
