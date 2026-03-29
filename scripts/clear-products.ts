import admin from "firebase-admin";
import { Pinecone } from "@pinecone-database/pinecone";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(fs.readFileSync("./agent-firebase-service.json", "utf8"));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

admin.firestore().settings({ ignoreUndefinedProperties: true });

const db = admin.firestore();

async function clearProducts() {
  const productsSnap = await db.collection("products").get();
  let deletedProducts = 0;

  for (const doc of productsSnap.docs) {
    await doc.ref.delete();
    deletedProducts++;
  }

  console.log(`🗑️ Productos eliminados de Firestore: ${deletedProducts}`);

  let deletedNamespaces = 0;
  let deletedVectors = 0;

  if (!process.env.PINECONE_API_KEY) {
    console.log("⚠️ PINECONE_API_KEY no configurada, se omite limpieza en Pinecone");
    return;
  }

  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const index = pinecone.index("chatbot-knowledge");
  const stats = await index.describeIndexStats();

  if (!stats.namespaces) {
    console.log("✅ No hay namespaces en Pinecone");
    return;
  }

  for (const [namespace, namespaceStats] of Object.entries(stats.namespaces)) {
    if (!namespace.startsWith("products_")) {
      continue;
    }

    const vectorCount = (namespaceStats as { recordCount?: number; vectorCount?: number }).recordCount
      ?? (namespaceStats as { recordCount?: number; vectorCount?: number }).vectorCount
      ?? 0;

    await index.namespace(namespace).deleteAll();
    deletedNamespaces++;
    deletedVectors += vectorCount;
    console.log(`🗑️ Namespace Pinecone eliminado: ${namespace} (${vectorCount} vectores)`);
  }

  console.log(`🗑️ Namespaces de productos eliminados en Pinecone: ${deletedNamespaces}`);
  console.log(`🗑️ Vectores de productos eliminados en Pinecone: ${deletedVectors}`);
}

clearProducts().catch((error) => {
  console.error("Error clearing products:", error);
  process.exit(1);
});
