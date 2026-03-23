import dotenv from "dotenv";
import { HumanMessage } from "@langchain/core/messages";
import { graph } from "../src/graph/index.js";
import admin from "firebase-admin";
import fs from "fs";

dotenv.config();

// Inicializar Firebase
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(fs.readFileSync("./agent-firebase-service.json", "utf8"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

async function testPersistence() {
  const db = admin.firestore();
  const agentId = "agent_f2c43c56-2944-4f37-b7d5-b59427b47f09"; // Eva
  const userId = "test_user_999";
  const docId = `conv_${agentId}_${userId}`;

  console.log(`🧪 Iniciando prueba de persistencia para el usuario: ${userId}`);

  // 1. Limpiar historial previo si existe para una prueba limpia
  await db.collection("history").doc(docId).delete();
  console.log("🧹 Historial previo eliminado.");

  const config = {
    configurable: { thread_id: "persistence_test_session" },
  };

  const initialState = {
    clientId: "org_2d8f74a1-b9c5-4e2a-bb6d-f492a8e310d5",
    agentId: agentId,
    userInfo: { 
      name: "Juan Perez", 
      phone: userId 
    },
    messages: [
      new HumanMessage("Hola Eva, guardá este código secreto: 'OVNI-2026'"),
    ],
  };

  try {
    console.log("🤖 Invocando al agente...");
    await graph.invoke(initialState, config);
    console.log("✅ El agente respondió.");

    // 2. Esperar un momento para asegurar el write en Firestore
    console.log("⏳ Verificando persistencia en Firestore...");
    await new Promise(resolve => setTimeout(resolve, 2000));

    const doc = await db.collection("history").doc(docId).get();

    if (doc.exists) {
      const data = doc.data();
      console.log("\n📄 DOCUMENTO ENCONTRADO EN FIRESTORE:");
      console.log(`- ID: ${doc.id}`);
      console.log(`- Cliente: ${data?.clientId}`);
      console.log(`- Mensajes guardados: ${data?.messages?.length}`);
      
      console.log("\n💬 ÚLTIMOS MENSAJES EN EL HISTORIAL:");
      data?.messages?.forEach((m: any, i: number) => {
        console.log(`  [${i}] ${m.role.toUpperCase()}: ${m.content.toString().substring(0, 50)}...`);
      });

      const hasSecret = data?.messages?.some((m: any) => m.content.includes("OVNI-2026"));
      if (hasSecret) {
        console.log("\n✨ ¡ÉXITO! La información fue persistida correctamente en el Nivel 2.");
      }
    } else {
      console.error("❌ ERROR: No se encontró el documento de historial en Firestore.");
    }

  } catch (error) {
    console.error("❌ Error durante el test:", error);
  }
}

testPersistence();
