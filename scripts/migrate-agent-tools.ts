import admin from "firebase-admin";
import fs from "fs";

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(fs.readFileSync("./agent-firebase-service.json", "utf8"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

async function migrateAgentTools() {
  const db = admin.firestore();
  const agentId = "agent_f2c43c56-2944-4f37-b7d5-b59427b47f09"; // ID de Eva

  console.log(`🚀 Iniciando migración de herramientas para el agente: ${agentId}`);

  const agentRef = db.collection("agents").doc(agentId);
  const agentDoc = await agentRef.get();

  if (!agentDoc.exists) {
    console.error("❌ Agente no encontrado.");
    return;
  }

  const currentFunctions: string[] = agentDoc.data()?.functions || [];
  
  // Definir el mapeo de migración
  const mapping: Record<string, string> = {
    "search_knowledge": "knowledge_retriever",
    "search_products": "product_catalog",
    "schedule_meeting": "appointment_manager",
  };

  // Crear la nueva lista de funciones
  const updatedFunctions = currentFunctions.map(fn => mapping[fn] || fn);

  // Asegurar que no haya duplicados y que estén las nuevas herramientas si corresponde
  const finalFunctions = [...new Set(updatedFunctions)];

  console.log("📝 Funciones anteriores:", currentFunctions);
  console.log("✅ Funciones nuevas:", finalFunctions);

  await agentRef.update({
    functions: finalFunctions,
    updatedAt: new Date().toISOString(),
    version: "2.0.0" // Marcamos que ya está en v2
  });

  console.log("🎉 Migración completada exitosamente en Firestore.");
}

migrateAgentTools();
