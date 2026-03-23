import admin from "firebase-admin";
import fs from "fs";

const serviceAccount = JSON.parse(
  fs.readFileSync("./agent-firebase-service.json", "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function debugAgents() {
  console.log("=== COLECCIÓN: agents ===\n");
  
  const agentsSnapshot = await db.collection("agents").get();
  
  if (agentsSnapshot.empty) {
    console.log("No hay agentes en la colección.");
    return;
  }

  for (const doc of agentsSnapshot.docs) {
    const data = doc.data();
    console.log(`📋 Agent ID: ${doc.id}`);
    console.log(`   clientId: ${data.clientId}`);
    console.log(`   name: ${data.name}`);
    console.log(`   skills: ${JSON.stringify(data.skills)}`);
    console.log(`   functions: ${JSON.stringify(data.functions)}`);
    console.log(`   knowledgeDocs: ${JSON.stringify(data.knowledgeDocs)}`);
    console.log(`   systemInstruction: ${(data.systemInstruction || "").substring(0, 200)}...`);
    console.log(`   businessContext: ${(data.businessContext || "").substring(0, 200)}...`);
    console.log("");
  }

  console.log("=== COLECCIÓN: clients ===\n");
  
  const clientsSnapshot = await db.collection("clients").get();
  
  if (clientsSnapshot.empty) {
    console.log("No hay clientes en la colección.");
    return;
  }

  for (const doc of clientsSnapshot.docs) {
    const data = doc.data();
    console.log(`🏢 Client ID: ${doc.id}`);
    console.log(`   name: ${data.name}`);
    console.log("");
  }
}

debugAgents()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });