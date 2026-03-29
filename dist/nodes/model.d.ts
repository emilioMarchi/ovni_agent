import { AgentStateType } from "../state/state.js";
export declare function modelNode(state: AgentStateType): Promise<{
    messages: import("@langchain/core/messages").AIMessageChunk[];
}>;
