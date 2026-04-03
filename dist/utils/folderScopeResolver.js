import admin from "../server/firebase.js";
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
export async function resolveAllowedDocIds(opts) {
    const { clientId, knowledgeDocs = [], knowledgeFolderIds = [], includeSubfolders = true } = opts;
    // Sin carpetas → comportamiento legacy
    if (knowledgeFolderIds.length === 0) {
        return knowledgeDocs;
    }
    const db = admin.firestore();
    const resolvedIds = new Set(knowledgeDocs);
    // Determinar qué folder IDs buscar (directo + subcarpetas)
    let effectiveFolderIds = new Set(knowledgeFolderIds);
    if (includeSubfolders) {
        // Buscar subcarpetas cuyo ancestors incluya cualquiera de las carpetas elegidas
        for (const fid of knowledgeFolderIds) {
            const subSnap = await db.collection("knowledge_folders")
                .where("clientId", "==", clientId)
                .where("ancestors", "array-contains", fid)
                .get();
            for (const sub of subSnap.docs) {
                effectiveFolderIds.add(sub.id);
            }
        }
    }
    // Buscar documentos cuyo folderId esté en el set de carpetas
    // Firestore "in" soporta hasta 30 valores
    const folderArray = [...effectiveFolderIds];
    const BATCH_SIZE = 30;
    for (let i = 0; i < folderArray.length; i += BATCH_SIZE) {
        const batch = folderArray.slice(i, i + BATCH_SIZE);
        const docsSnap = await db.collection("knowledge_docs")
            .where("clientId", "==", clientId)
            .where("folderId", "in", batch)
            .get();
        for (const doc of docsSnap.docs) {
            resolvedIds.add(doc.id);
        }
    }
    return [...resolvedIds];
}
//# sourceMappingURL=folderScopeResolver.js.map