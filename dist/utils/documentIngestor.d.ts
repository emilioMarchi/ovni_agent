type IngestDocumentParams = {
    filePath: string;
    clientId: string;
    docId: string;
    filename: string;
    description?: string;
    docType?: "reference" | "contract";
    folderId?: string | null;
    signal?: AbortSignal;
    onProgress?: (update: {
        stage: string;
        progress: number;
        message: string;
    }) => Promise<void> | void;
};
export declare function processAndIngestDocument({ filePath, clientId, docId, filename, description, docType, folderId, signal, onProgress }: IngestDocumentParams): Promise<{
    docId: string;
    partsCount: number;
    processingReport: {
        totalBatches: number;
        successBatches: number;
        retryBatches: number;
        failedBatches: number;
        failedDetails: {
            batch: number;
            error: string | undefined;
            charRange: string | undefined;
            contentPreview: string | undefined;
        }[];
        batchBreakdown: {
            batch: number;
            status: "ok" | "retry_ok" | "failed";
            parts: number;
            charRange: string | undefined;
        }[];
        totalFragments: number;
        totalChars: number;
        completeness: string;
    };
}>;
export {};
