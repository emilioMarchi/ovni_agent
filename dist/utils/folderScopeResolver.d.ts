/**
 * Resuelve las carpetas y documentos sueltos de un agente en una lista plana de docIds.
 *
 * Lógica:
 * 1. Si el agente tiene knowledgeFolderIds, obtiene todos los docs dentro de esas carpetas
 *    (y subcarpetas si includeSubfolders=true).
 * 2. Suma los knowledgeDocs explícitos (docs sueltos asignados directamente).
 * 3. Devuelve la unión deduplicada.
 *
 * Si el agente no tiene carpetas, devuelve solo knowledgeDocs (compatibilidad total).
 */
export declare function resolveAllowedDocIds(opts: {
    clientId: string;
    knowledgeDocs?: string[];
    knowledgeFolderIds?: string[];
    includeSubfolders?: boolean;
}): Promise<string[]>;
