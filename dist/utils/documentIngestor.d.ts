type IngestDocumentParams = {
    filePath: string;
    clientId: string;
    docId: string;
    filename: string;
    description?: string;
    onProgress?: (update: {
        stage: string;
        progress: number;
        message: string;
    }) => Promise<void> | void;
};
export declare function processAndIngestDocument({ filePath, clientId, docId, filename, description, onProgress }: IngestDocumentParams): Promise<{
    docId: string;
    partsCount: number;
}>;
export {};
