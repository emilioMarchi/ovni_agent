import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
/**
 * Herramienta para envío de comunicaciones (Email) vía Resend.
 */
export declare const commsSenderTool: DynamicStructuredTool<z.ZodObject<{
    to: z.ZodString;
    subject: z.ZodString;
    body: z.ZodString;
    fromName: z.ZodDefault<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    to: string;
    subject: string;
    body: string;
    fromName: string;
}, {
    to: string;
    subject: string;
    body: string;
    fromName?: string | undefined;
}>, {
    to: string;
    subject: string;
    body: string;
    fromName: string;
}, {
    to: string;
    subject: string;
    body: string;
    fromName?: string | undefined;
}, string>;
