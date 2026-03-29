export interface SessionClassification {
    type: "lead" | "conversation" | "support";
    interestLevel: "high" | "medium" | "low";
    intentions: string[];
    topics: string[];
    sentiment: "positive" | "neutral" | "negative";
}
export interface SessionAnalysis {
    summary: string;
    classification: SessionClassification;
}
export declare function analyzeSession(messages: any[], userName?: string | null): Promise<SessionAnalysis>;
