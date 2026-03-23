import admin from "firebase-admin";
import fs from "fs";

const serviceAccount = JSON.parse(
  fs.readFileSync("./agent-firebase-service.json", "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function fixEva() {
  const agentId = "agent_f2c43c56-2944-4f37-b7d5-b59427b47f09";
  const agentRef = db.collection("agents").doc(agentId);
  
  console.log("📋 Estado actual de Eva:");
  const doc = await agentRef.get();
  const data = doc.data();
  console.log("   skills:", JSON.stringify(data?.skills));
  console.log("   functions:", JSON.stringify(data?.functions));
  console.log("");

  console.log("🔧 Actualizando Eva...");
  
  await agentRef.update({
    skills: ["knowledge", "sales", "history", "calendar"],
    functions: ["knowledge_retriever", "product_catalog", "history_retriever", "appointment_manager"],
  });

  console.log("✅ Eva actualizada!");
  
  console.log("\n📋 Nuevo estado de Eva:");
  const updated = await agentRef.get();
  const newData = updated.data();
  console.log("   skills:", JSON.stringify(newData?.skills));
  console.log("   functions:", JSON.stringify(newData?.functions));
}

fixEva()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });