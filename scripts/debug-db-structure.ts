import admin from "firebase-admin";
import fs from "fs";

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(fs.readFileSync("./agent-firebase-service.json", "utf8"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

async function debugDatabaseStructure() {
  const db = admin.firestore();
  
  console.log("🔍 Investigando estructura de Admins...");
  const adminsSnapshot = await db.collection("admins").limit(1).get();
  
  if (adminsSnapshot.empty) {
    console.log("❌ No se encontraron admins.");
    return;
  }

  const adminDoc = adminsSnapshot.docs[0];
  const adminId = adminDoc.id;
  console.log(`✅ Admin encontrado: ${adminId} (${adminDoc.data().name})`);

  console.log(`🔍 Buscando agentes para el admin: ${adminId}...`);
  const agentsSnapshot = await db.collection("agents")
    .where("clientId", "==", adminId)
    .limit(1)
    .get();

  if (agentsSnapshot.empty) {
    console.log("⚠️ Este admin no tiene agentes configurados.");
  } else {
    const agentDoc = agentsSnapshot.docs[0];
    console.log(`✅ Agente encontrado: ${agentDoc.id}`);
    console.log("📄 Configuración del Agente:", JSON.stringify(agentDoc.data(), null, 2));
  }
}

debugDatabaseStructure();
