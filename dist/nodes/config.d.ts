import { AgentStateType } from "../state/state.js";
import { RunnableConfig } from "@langchain/core/runnables";
/**
 * Nodo de Configuración: Hidrata el estado inicial con la información del agente
 * desde Firestore (skills, knowledgeDocs, instructions).
 */
export declare function configNode(state: AgentStateType, _: any, config?: RunnableConfig): Promise<{
    systemInstruction: string;
} | {
    systemInstruction?: undefined;
} | {
    threadId: any;
    systemInstruction?: undefined;
} | {
    threadId: any;
    clientId: any;
    agentName: any;
    agentDescription: any;
    organizationName: any;
    businessContext: string;
    systemInstruction: any;
    allowedDocIds: any;
    skills: any;
    functions: any;
}>;
