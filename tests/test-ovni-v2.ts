import dotenv from "dotenv";
import { HumanMessage } from "@langchain/core/messages";
import { graph } from "../src/graph/index.js";
import admin from "firebase-admin";
import fs from "fs";

dotenv.config();

// 1. Inicializar Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(fs.readFileSync("./agent-firebase-service.json", "utf8"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

/**
 * Prueba del Agente con DATOS REALES de Firestore y Pinecone.
 */
async function testAgentFlow() {
  console.log("🚀 Iniciando prueba real del Agente OVNI v2 (Eva)...");

  const config = {
    configurable: {
      thread_id: "session_" + Date.now(),
    },
  };

  const initialState = {
    // Usamos los IDs reales encontrados en el debug
    clientId: "org_2d8f74a1-b9c5-4e2a-bb6d-f492a8e310d5",
    agentId: "agent_f2c43c56-2944-4f37-b7d5-b59427b47f09",
    messages: [
      new HumanMessage("Hola Eva, ¿qué es OVNI Studio?"),
    ],
  };

  try {
    console.log("\n--- Turno 1: Consulta de Conocimiento (RAG) ---");
    const result1 = await graph.invoke(initialState, config);
    const lastMsg1 = result1.messages[result1.messages.length - 1];
    console.log("Eva:", lastMsg1.content);

    console.log("\n--- Turno 2: Pregunta de Seguimiento ---");
    const result2 = await graph.invoke({
      messages: [new HumanMessage("¿Cuáles son los servicios principales?")],
    }, config);
    const lastMsg2 = result2.messages[result2.messages.length - 1];
    console.log("Eva:", lastMsg2.content);

    console.log("\n✅ Prueba finalizada con éxito.");
  } catch (error) {
    console.error("❌ Error durante la prueba:", error);
  }
}

testAgentFlow();
