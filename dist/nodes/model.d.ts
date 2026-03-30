import { AIMessage } from "@langchain/core/messages";
import { AgentStateType } from "../state/state.js";
export declare function modelNode(state: AgentStateType): Promise<{
    messages: AIMessage[];
}>;
