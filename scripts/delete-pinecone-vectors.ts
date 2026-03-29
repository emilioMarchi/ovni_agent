
import dotenv from "dotenv";
dotenv.config();
import { Pinecone } from "@pinecone-database/pinecone";

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });

async function deletePineconeVectors(indexName: string, namespace: string, ids: string[]) {
  const index = pinecone.index(indexName);
  for (const id of ids) {
    try {
      await index.namespace(namespace).deleteOne(id);
      console.log(`Eliminado de Pinecone: ${id}`);
    } catch (e) {
      console.error(`Error eliminando ${id}:`, e?.message || e);
    }
  }
}

// Uso: tsx delete-pinecone-vectors.ts <indexName> <namespace> <id1,id2,...>
const [,, indexName, namespace, idsStr] = process.argv;
if (!indexName || !namespace || !idsStr) {
  console.error("Uso: tsx delete-pinecone-vectors.ts <indexName> <namespace> <id1,id2,...>");
  process.exit(1);
}
const ids = idsStr.split(",");
deletePineconeVectors(indexName, namespace, ids);