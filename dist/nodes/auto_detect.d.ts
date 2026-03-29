import { AgentStateType } from "../state/state.js";
export declare function autoDetectAndInvoke(state: AgentStateType): Promise<{
    ragContext?: undefined;
} | {
    ragContext: string;
}>;
