// Procesador de documentos para Firestore y Pinecone siguiendo la lógica RAG
// Soporta: pdf, txt, doc, docx, md, json, xlsx, xls, csv
import admin from "../server/firebase.js";
import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { extractTextFromFile } from "./extractText.js";
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "gemini-embedding-001",
    taskType: TaskType.RETRIEVAL_QUERY,
    apiKey: process.env.GEMINI_API_KEY,
});
const chatModel = new ChatGoogleGenerativeAI({
    modelName: "gemini-2.5-flash",
    temperature: 0.2,
    apiKey: process.env.GEMINI_API_KEY,
});
function extractMessageText(content) {
    if (typeof content === "string") {
        return content;
    }
    if (!Array.isArray(content)) {
        return "";
    }
    return content
        .map((item) => {
        if (typeof item === "string") {
            return item;
        }
        if (item && typeof item === "object" && "text" in item && typeof item.text === "string") {
            return item.text;
        }
        return "";
    })
        .join("\n");
}
export async function processAndIngestDocument({ filePath, clientId, docId, filename, description, onProgress }) {
    const db = admin.firestore();
    const reportProgress = async (stage, progress, message) => {
        if (onProgress) {
            await onProgress({ stage, progress, message });
        }
    };
    await reportProgress("extracting", 12, `Extrayendo contenido de ${filename}`);
    // 1. Extraer texto
    const text = await extractTextFromFile(filePath, filename);
    await reportProgress("analyzing", 28, `Contenido extraído (${text.length} caracteres). Analizando con Gemini...`);
    // 2. Pedir a Gemini que divida en párrafos relevantes y genere keywords
    const prompt = `Divide el siguiente texto en fragmentos o párrafos relevantes para búsqueda semántica. Para cada fragmento, genera un resumen breve y una lista de 3-7 keywords. Devuelve SOLO un JSON válido con la estructura: [{text, summary, keywords:[]}]. Texto:\n${text.slice(0, 12000)}`;
    const result = await chatModel.invoke(prompt);
    const content = extractMessageText(result.content);
    const cleaned = content.replace(/```json|```/g, "").trim();
    let parts = [];
    try {
        parts = JSON.parse(cleaned);
    }
    catch (e) {
        throw new Error("Error parsing Gemini output: " + e);
    }
    await reportProgress("structuring", 46, `Gemini devolvió ${parts.length} fragmentos. Guardando metadata...`);
    // Generar keywords y descripción general para el documento
    const allKeywords = Array.from(new Set(parts.flatMap((part) => Array.isArray(part.keywords) ? part.keywords : [])));
    const generalDescription = parts.map((part) => (typeof part.summary === "string" ? part.summary : "")).filter(Boolean).join(" ").slice(0, 400);
    const finalDescription = description || generalDescription;
    // 3. Guardar metadata en knowledge_docs
    await db.collection("knowledge_docs").doc(docId).set({
        clientId,
        filename,
        description: finalDescription,
        keywords: allKeywords,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "processed",
        partsCount: parts.length,
    }, { merge: true });
    const index = pinecone.index("chatbot-knowledge");
    const namespace = `client_${clientId}`;
    // 4. Vectorizar la descripción del documento en document_catalog
    //    Esto permite al knowledge_retriever pre-filtrar qué docs son relevantes
    await reportProgress("catalog_index", 58, "Indexando catálogo documental en Pinecone...");
    const catalogText = `${filename}: ${finalDescription}. Keywords: ${allKeywords.join(", ")}`;
    const catalogVector = await embeddings.embedQuery(catalogText);
    await index.namespace("document_catalog").upsert([{
            id: docId,
            values: catalogVector,
            metadata: {
                clientId,
                docId,
                filename,
                description: finalDescription,
                keywords: allKeywords.join(", "),
            },
        }]);
    // 5. Guardar partes en knowledge_parts y Pinecone
    await reportProgress("fragment_index", 65, `Indexando ${parts.length} fragmentos en Pinecone...`);
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const partId = `part_${docId}_${i}`;
        // Guardar en Firestore
        await db.collection("knowledge_parts").doc(partId).set({
            docId,
            clientId,
            filename,
            text: part.text,
            summary: part.summary,
            keywords: part.keywords,
            createdAt: new Date().toISOString(),
            idx: i,
        });
        // Texto enriquecido para vectorizar: incluye summary y keywords para mejorar matching
        const enrichedText = `${part.text}\n\nResumen: ${part.summary || ""}\nKeywords: ${(part.keywords || []).join(", ")}`;
        const vector = await embeddings.embedQuery(enrichedText);
        await index.namespace(namespace).upsert([{
                id: partId,
                values: vector,
                metadata: {
                    docId,
                    clientId,
                    filename,
                    description: part.summary || "",
                    text: part.text,
                    keywords: (part.keywords || []).join(", "),
                    idx: i,
                },
            }]);
        const fragmentProgress = parts.length > 0
            ? Math.min(95, 65 + Math.round(((i + 1) / parts.length) * 30))
            : 95;
        await reportProgress("fragment_index", fragmentProgress, `Fragmento ${i + 1} de ${parts.length} indexado`);
    }
    await reportProgress("finalizing", 98, "Finalizando indexación y persistencia...");
    console.log(`✅ Documento ingestado: ${filename} (${parts.length} partes) → namespace: ${namespace}, document_catalog`);
    return { docId, partsCount: parts.length };
}
//# sourceMappingURL=documentIngestor.js.map