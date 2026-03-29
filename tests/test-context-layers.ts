import dotenv from "dotenv";
import { graph } from "../dist/graph/index.js";
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

async function testContextLayers() {
  const db = admin.firestore();
  const agentId = "agent_f2c43c56-2944-4f37-b7d5-b59427b47f09";
  const userId = "test_user_layers";
  const docId = `conv_${agentId}_${userId}`;

  // Limpiar historial previo
  await db.collection("history").doc(docId).delete();

  // Simular mensajes previos
  const fakeMessages = [];
  for (let i = 1; i <= 40; i++) {
    fakeMessages.push({
      role: i % 2 === 0 ? "assistant" : "user",
      content: i === 10 ? "PalabraClaveUnica" : `Mensaje ${i}`,
      timestamp: new Date(Date.now() - (40 - i) * 60000).toISOString(),
    });
  }
  await db.collection("history").doc(docId).set({
    clientId: "org_2d8f74a1-b9c5-4e2a-bb6d-f492a8e310d5",
    agentId,
    userId,
    threadId: "layers_test_session",
    messages: fakeMessages,
  });

  // Invocar grafo con pocos mensajes recientes y una query específica
  const config = {
    configurable: { thread_id: "layers_test_session" },
  };
  const initialState = {
    clientId: "org_2d8f74a1-b9c5-4e2a-bb6d-f492a8e310d5",
    agentId,
    userInfo: { email: userId },
    threadId: "layers_test_session",
    messages: [{ role: "user", content: "¿Dónde está la PalabraClaveUnica?" }],
    contextQuery: "PalabraClaveUnica",
  };

  const result = await graph.invoke(initialState, config) as Record<string, unknown>;
  console.log("\n🧪 Resultado del grafo con capas de contexto:");
  console.log(result.contextHistory);
}

testContextLayers();
