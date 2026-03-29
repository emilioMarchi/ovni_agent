/**
 * Compilar el grafo para su ejecución.
 */
export declare const graph: import("@langchain/langgraph").CompiledStateGraph<import("@langchain/langgraph").StateType<{
    clientId: import("@langchain/langgraph").LastValue<string>;
    agentId: import("@langchain/langgraph").LastValue<string>;
    userInfo: import("@langchain/langgraph").BinaryOperatorAggregate<import("../state/state.js").UserInfo, import("../state/state.js").UserInfo>;
    businessContext: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    systemInstruction: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    allowedDocIds: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    skills: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    functions: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    flowState: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    threadId: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    endSession: import("@langchain/langgraph").BinaryOperatorAggregate<boolean, boolean>;
    ragContext: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    outputAudio: import("@langchain/langgraph").BinaryOperatorAggregate<boolean, boolean>;
    audioBuffer: import("@langchain/langgraph").BinaryOperatorAggregate<Buffer<ArrayBufferLike> | null, Buffer<ArrayBufferLike> | null>;
    contextHistory: import("@langchain/langgraph").BinaryOperatorAggregate<{
        role: string;
        content: string;
        timestamp: string;
    }[], {
        role: string;
        content: string;
        timestamp: string;
    }[]>;
    contextQuery: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    fastPath: import("@langchain/langgraph").BinaryOperatorAggregate<boolean, boolean>;
    messages: import("@langchain/langgraph").BinaryOperatorAggregate<import("@langchain/core/messages").BaseMessage[], import("@langchain/langgraph").Messages>;
}>, import("@langchain/langgraph").UpdateType<{
    clientId: import("@langchain/langgraph").LastValue<string>;
    agentId: import("@langchain/langgraph").LastValue<string>;
    userInfo: import("@langchain/langgraph").BinaryOperatorAggregate<import("../state/state.js").UserInfo, import("../state/state.js").UserInfo>;
    businessContext: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    systemInstruction: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    allowedDocIds: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    skills: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    functions: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    flowState: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    threadId: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    endSession: import("@langchain/langgraph").BinaryOperatorAggregate<boolean, boolean>;
    ragContext: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    outputAudio: import("@langchain/langgraph").BinaryOperatorAggregate<boolean, boolean>;
    audioBuffer: import("@langchain/langgraph").BinaryOperatorAggregate<Buffer<ArrayBufferLike> | null, Buffer<ArrayBufferLike> | null>;
    contextHistory: import("@langchain/langgraph").BinaryOperatorAggregate<{
        role: string;
        content: string;
        timestamp: string;
    }[], {
        role: string;
        content: string;
        timestamp: string;
    }[]>;
    contextQuery: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    fastPath: import("@langchain/langgraph").BinaryOperatorAggregate<boolean, boolean>;
    messages: import("@langchain/langgraph").BinaryOperatorAggregate<import("@langchain/core/messages").BaseMessage[], import("@langchain/langgraph").Messages>;
}>, "config" | "history_retriever" | "__start__" | "speech_to_text" | "agent" | "tools" | "text_to_speech" | "save_history", {
    clientId: import("@langchain/langgraph").LastValue<string>;
    agentId: import("@langchain/langgraph").LastValue<string>;
    userInfo: import("@langchain/langgraph").BinaryOperatorAggregate<import("../state/state.js").UserInfo, import("../state/state.js").UserInfo>;
    businessContext: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    systemInstruction: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    allowedDocIds: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    skills: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    functions: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    flowState: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    threadId: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    endSession: import("@langchain/langgraph").BinaryOperatorAggregate<boolean, boolean>;
    ragContext: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    outputAudio: import("@langchain/langgraph").BinaryOperatorAggregate<boolean, boolean>;
    audioBuffer: import("@langchain/langgraph").BinaryOperatorAggregate<Buffer<ArrayBufferLike> | null, Buffer<ArrayBufferLike> | null>;
    contextHistory: import("@langchain/langgraph").BinaryOperatorAggregate<{
        role: string;
        content: string;
        timestamp: string;
    }[], {
        role: string;
        content: string;
        timestamp: string;
    }[]>;
    contextQuery: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    fastPath: import("@langchain/langgraph").BinaryOperatorAggregate<boolean, boolean>;
    messages: import("@langchain/langgraph").BinaryOperatorAggregate<import("@langchain/core/messages").BaseMessage[], import("@langchain/langgraph").Messages>;
}, {
    clientId: import("@langchain/langgraph").LastValue<string>;
    agentId: import("@langchain/langgraph").LastValue<string>;
    userInfo: import("@langchain/langgraph").BinaryOperatorAggregate<import("../state/state.js").UserInfo, import("../state/state.js").UserInfo>;
    businessContext: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    systemInstruction: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    allowedDocIds: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    skills: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    functions: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    flowState: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    threadId: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    endSession: import("@langchain/langgraph").BinaryOperatorAggregate<boolean, boolean>;
    ragContext: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    outputAudio: import("@langchain/langgraph").BinaryOperatorAggregate<boolean, boolean>;
    audioBuffer: import("@langchain/langgraph").BinaryOperatorAggregate<Buffer<ArrayBufferLike> | null, Buffer<ArrayBufferLike> | null>;
    contextHistory: import("@langchain/langgraph").BinaryOperatorAggregate<{
        role: string;
        content: string;
        timestamp: string;
    }[], {
        role: string;
        content: string;
        timestamp: string;
    }[]>;
    contextQuery: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    fastPath: import("@langchain/langgraph").BinaryOperatorAggregate<boolean, boolean>;
    messages: import("@langchain/langgraph").BinaryOperatorAggregate<import("@langchain/core/messages").BaseMessage[], import("@langchain/langgraph").Messages>;
}, import("@langchain/langgraph").StateDefinition>;
/**
 * Exportar el grafo para su uso en la aplicación principal o tests.
 */
export default graph;
