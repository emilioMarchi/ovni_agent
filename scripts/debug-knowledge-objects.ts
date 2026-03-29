import admin from "firebase-admin";
import fs from "fs";

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(fs.readFileSync("./agent-firebase-service.json", "utf8"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

async function showKnowledgeDocsAndParts() {
  const db = admin.firestore();
  console.log("=== COLECCIÓN: knowledge_docs ===\n");
  const docsSnapshot = await db.collection("knowledge_docs").limit(5).get();
  if (docsSnapshot.empty) {
    console.log("No hay documentos en knowledge_docs.");
  } else {
    for (const doc of docsSnapshot.docs) {
      console.log(`📄 Doc ID: ${doc.id}\n${JSON.stringify(doc.data(), null, 2)}\n---`);
    }
  }
  console.log("\n=== COLECCIÓN: knowledge_parts ===\n");
  const partsSnapshot = await db.collection("knowledge_parts").limit(5).get();
  if (partsSnapshot.empty) {
    console.log("No hay partes en knowledge_parts.");
  } else {
    for (const doc of partsSnapshot.docs) {
      console.log(`🧩 Part ID: ${doc.id}\n${JSON.stringify(doc.data(), null, 2)}\n---`);
    }
  }
}

showKnowledgeDocsAndParts();
