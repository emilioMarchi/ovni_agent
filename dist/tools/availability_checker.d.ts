import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
export declare const availabilityCheckerTool: DynamicStructuredTool<z.ZodObject<{
    action: z.ZodEnum<["check_next_days", "check_specific_day"]>;
    clientId: z.ZodString;
    daysAhead: z.ZodOptional<z.ZodNumber>;
    date: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    clientId: string;
    action: "check_next_days" | "check_specific_day";
    date?: string | undefined;
    daysAhead?: number | undefined;
}, {
    clientId: string;
    action: "check_next_days" | "check_specific_day";
    date?: string | undefined;
    daysAhead?: number | undefined;
}>, {
    clientId: string;
    action: "check_next_days" | "check_specific_day";
    date?: string | undefined;
    daysAhead?: number | undefined;
}, {
    clientId: string;
    action: "check_next_days" | "check_specific_day";
    date?: string | undefined;
    daysAhead?: number | undefined;
}, string>;
