import { knowledgeRetrieverTool } from "./knowledge_retriever.js";
import { productCatalogTool } from "./product_catalog.js";
import { userProfileManagerTool } from "./user_profile_manager.js";
import { commsSenderTool } from "./comms_sender.js";
import { appointmentManagerTool } from "./appointment_manager.js";
import { historyRetrieverTool } from "./history_retriever.js";
import { contextManagerTool } from "./context_manager.js";
/**
 * Catálogo completo de herramientas disponibles para el Agente OVNI v2.
 */
export declare const tools: (import("@langchain/core/tools").DynamicStructuredTool<import("zod").ZodObject<{
    query: import("zod").ZodString;
    clientId: import("zod").ZodString;
    allowedDocIds: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
}, "strip", import("zod").ZodTypeAny, {
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
}, string> | import("@langchain/core/tools").DynamicStructuredTool<import("zod").ZodObject<{
    query: import("zod").ZodEffects<import("zod").ZodDefault<import("zod").ZodString>, string, unknown>;
    clientId: import("zod").ZodEffects<import("zod").ZodString, string, unknown>;
    allowedCategories: import("zod").ZodDefault<import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>>;
    allowedDocIds: import("zod").ZodDefault<import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>>;
    listAll: import("zod").ZodDefault<import("zod").ZodOptional<import("zod").ZodBoolean>>;
}, "strip", import("zod").ZodTypeAny, {
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
}, string> | import("@langchain/core/tools").DynamicStructuredTool<import("zod").ZodObject<{
    action: import("zod").ZodEnum<["get", "update", "create"]>;
    userId: import("zod").ZodString;
    clientId: import("zod").ZodString;
    data: import("zod").ZodOptional<import("zod").ZodObject<{
        name: import("zod").ZodOptional<import("zod").ZodString>;
        email: import("zod").ZodOptional<import("zod").ZodString>;
        phone: import("zod").ZodOptional<import("zod").ZodString>;
        flowState: import("zod").ZodOptional<import("zod").ZodString>;
        metadata: import("zod").ZodOptional<import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>>;
    }, "strip", import("zod").ZodTypeAny, {
        flowState?: string | undefined;
        email?: string | undefined;
        name?: string | undefined;
        phone?: string | undefined;
        metadata?: Record<string, any> | undefined;
    }, {
        flowState?: string | undefined;
        email?: string | undefined;
        name?: string | undefined;
        phone?: string | undefined;
        metadata?: Record<string, any> | undefined;
    }>>;
}, "strip", import("zod").ZodTypeAny, {
    clientId: string;
    action: "create" | "get" | "update";
    userId: string;
    data?: {
        flowState?: string | undefined;
        email?: string | undefined;
        name?: string | undefined;
        phone?: string | undefined;
        metadata?: Record<string, any> | undefined;
    } | undefined;
}, {
    clientId: string;
    action: "create" | "get" | "update";
    userId: string;
    data?: {
        flowState?: string | undefined;
        email?: string | undefined;
        name?: string | undefined;
        phone?: string | undefined;
        metadata?: Record<string, any> | undefined;
    } | undefined;
}>, {
    clientId: string;
    action: "create" | "get" | "update";
    userId: string;
    data?: {
        flowState?: string | undefined;
        email?: string | undefined;
        name?: string | undefined;
        phone?: string | undefined;
        metadata?: Record<string, any> | undefined;
    } | undefined;
}, {
    clientId: string;
    action: "create" | "get" | "update";
    userId: string;
    data?: {
        flowState?: string | undefined;
        email?: string | undefined;
        name?: string | undefined;
        phone?: string | undefined;
        metadata?: Record<string, any> | undefined;
    } | undefined;
}, string> | import("@langchain/core/tools").DynamicStructuredTool<import("zod").ZodObject<{
    to: import("zod").ZodString;
    subject: import("zod").ZodString;
    body: import("zod").ZodString;
    fromName: import("zod").ZodDefault<import("zod").ZodOptional<import("zod").ZodString>>;
}, "strip", import("zod").ZodTypeAny, {
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
}, string> | import("@langchain/core/tools").DynamicStructuredTool<import("zod").ZodObject<{
    action: import("zod").ZodEnum<["save_user", "save_business", "get", "get_summary"]>;
    threadId: import("zod").ZodString;
    userData: import("zod").ZodOptional<import("zod").ZodObject<{
        name: import("zod").ZodOptional<import("zod").ZodString>;
        email: import("zod").ZodOptional<import("zod").ZodString>;
        phone: import("zod").ZodOptional<import("zod").ZodString>;
    }, "strip", import("zod").ZodTypeAny, {
        email?: string | undefined;
        name?: string | undefined;
        phone?: string | undefined;
    }, {
        email?: string | undefined;
        name?: string | undefined;
        phone?: string | undefined;
    }>>;
    businessData: import("zod").ZodOptional<import("zod").ZodObject<{
        rubric: import("zod").ZodOptional<import("zod").ZodString>;
        localidad: import("zod").ZodOptional<import("zod").ZodString>;
        proyecto: import("zod").ZodOptional<import("zod").ZodString>;
    }, "strip", import("zod").ZodTypeAny, {
        rubric?: string | undefined;
        localidad?: string | undefined;
        proyecto?: string | undefined;
    }, {
        rubric?: string | undefined;
        localidad?: string | undefined;
        proyecto?: string | undefined;
    }>>;
    field: import("zod").ZodOptional<import("zod").ZodString>;
}, "strip", import("zod").ZodTypeAny, {
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
}, string> | import("@langchain/core/tools").DynamicStructuredTool<import("zod").ZodObject<{
    action: import("zod").ZodDefault<import("zod").ZodEnum<["check_availability", "check_next_days", "schedule"]>>;
    clientId: import("zod").ZodString;
    threadId: import("zod").ZodOptional<import("zod").ZodString>;
    date: import("zod").ZodOptional<import("zod").ZodString>;
    time: import("zod").ZodOptional<import("zod").ZodString>;
    userInfo: import("zod").ZodOptional<import("zod").ZodObject<{
        name: import("zod").ZodOptional<import("zod").ZodString>;
        email: import("zod").ZodOptional<import("zod").ZodString>;
        phone: import("zod").ZodOptional<import("zod").ZodString>;
    }, "strip", import("zod").ZodTypeAny, {
        email?: string | undefined;
        name?: string | undefined;
        phone?: string | undefined;
    }, {
        email?: string | undefined;
        name?: string | undefined;
        phone?: string | undefined;
    }>>;
    topic: import("zod").ZodOptional<import("zod").ZodString>;
    confirmedByUser: import("zod").ZodOptional<import("zod").ZodBoolean>;
}, "strip", import("zod").ZodTypeAny, {
    clientId: string;
    action: "check_availability" | "check_next_days" | "schedule";
    userInfo?: {
        email?: string | undefined;
        name?: string | undefined;
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
        email?: string | undefined;
        name?: string | undefined;
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
        email?: string | undefined;
        name?: string | undefined;
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
        email?: string | undefined;
        name?: string | undefined;
        phone?: string | undefined;
    } | undefined;
    threadId?: string | undefined;
    date?: string | undefined;
    time?: string | undefined;
    action?: "check_availability" | "check_next_days" | "schedule" | undefined;
    topic?: string | undefined;
    confirmedByUser?: boolean | undefined;
}, string> | import("@langchain/core/tools").DynamicStructuredTool<import("zod").ZodObject<{
    query: import("zod").ZodString;
    userId: import("zod").ZodString;
    agentId: import("zod").ZodString;
}, "strip", import("zod").ZodTypeAny, {
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
}, string>)[];
export { knowledgeRetrieverTool, productCatalogTool, userProfileManagerTool, commsSenderTool, appointmentManagerTool, historyRetrieverTool, contextManagerTool, };
