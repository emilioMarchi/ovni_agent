// Procesador de documentos para Firestore y Pinecone siguiendo la lógica RAG
// Soporta: pdf, txt, doc, md (extensible)

import admin from "../server/firebase.js";
import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { extractTextFromFile } from "./extractText";
import path from "path";

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "gemini-embedding-001",
  taskType: "RETRIEVAL_QUERY",
  apiKey: process.env.GEMINI_API_KEY,
});
const chatModel = new ChatGoogleGenerativeAI({
  modelName: "gemini-2.5-flash",
  temperature: 0.2,
  apiKey: process.env.GEMINI_API_KEY,
});

export async function processAndIngestDocument({ filePath, clientId, docId, filename, description }) {
  const db = admin.firestore();
  const ext = path.extname(filename).toLowerCase();

  // 1. Extraer texto
  const text = await extractTextFromFile(filePath);

  // 2. Pedir a Gemini que divida en párrafos relevantes y genere keywords
  const prompt = `Divide el siguiente texto en fragmentos o párrafos relevantes para búsqueda semántica. Para cada fragmento, genera un resumen breve y una lista de 3-7 keywords. Devuelve SOLO un JSON válido con la estructura: [{text, summary, keywords:[]}]. Texto:\n${text.slice(0, 12000)}`;
  const result = await chatModel.invoke(prompt);
  const cleaned = (result.content || "").replace(/```json|```/g, "").trim();
  let parts = [];
  try {
    parts = JSON.parse(cleaned);
  } catch (e) {
    throw new Error("Error parsing Gemini output: " + e);
  }

  // Generar keywords y descripción general para el documento
  const allKeywords = Array.from(new Set(parts.flatMap(p => Array.isArray(p.keywords) ? p.keywords : [])));
  const generalDescription = parts.map(p => (typeof p.summary === "string" ? p.summary : "")).filter(Boolean).join(" ").slice(0, 400);

  // 3. Guardar metadata en knowledge_docs
  await db.collection("knowledge_docs").doc(docId).set({
    clientId,
    filename,
    description: description || generalDescription,
    keywords: allKeywords,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "processed",
    partsCount: parts.length,
  }, { merge: true });

  // 4. Guardar partes en knowledge_parts y Pinecone
  const index = pinecone.index("chatbot-knowledge");
  const namespace = `client_${clientId}`;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const partId = `${docId}_part${i}`;
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
    // Vectorizar y guardar en Pinecone
    const vector = await embeddings.embedQuery(part.text);
    await index.namespace(namespace).upsert([{
      id: partId,
      values: vector,
      metadata: {
        docId,
        filename,
        description: part.summary,
        text: part.text,
        keywords: part.keywords,
        idx: i,
      },
    }]);
  }
  return { docId, partsCount: parts.length };
}
