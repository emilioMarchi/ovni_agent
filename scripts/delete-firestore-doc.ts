import admin from "firebase-admin";
import fs from "fs";

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(fs.readFileSync("./agent-firebase-service.json", "utf8"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

async function deleteFirestoreDoc(collection: string, docId: string) {
  const db = admin.firestore();
  await db.collection(collection).doc(docId).delete();
  console.log(`Eliminado: ${collection}/${docId}`);
}

// Argumentos: node delete-firestore-doc.ts <collection> <docId>
const [,, collection, docId] = process.argv;
if (!collection || !docId) {
  console.error("Uso: tsx delete-firestore-doc.ts <collection> <docId>");
  process.exit(1);
}
deleteFirestoreDoc(collection, docId);