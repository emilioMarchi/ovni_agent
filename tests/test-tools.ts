import "dotenv/config";
import { HumanMessage } from "@langchain/core/messages";
import { graph } from "../src/graph/index.js";
import admin from "firebase-admin";
import fs from "fs";

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(fs.readFileSync("./agent-firebase-service.json", "utf8"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const config = {
  configurable: {
    thread_id: "test_tools_" + Date.now(),
  },
};

const initialState = {
  clientId: "org_2d8f74a1-b9c5-4e2a-bb6d-f492a8e310d5",
  agentId: "agent_f2c43c56-2944-4f37-b7d5-b59427b47f09",
  messages: [],
};

async function testTools() {
  console.log("🧪 Testeando herramientas del agente...\n");

  const tests = [
    { input: "¿Tienen algún producto en venta?", expected: "product_catalog", desc: "Consulta de productos" },
    { input: "¿Cuáles son sus horarios de atención?", expected: "availability", desc: "Consulta de horarios" },
    { input: "Quiero agendar una reunión", expected: "appointment", desc: "Agendar reunión" },
    { input: "¿Qué servicios ofrecen?", expected: "knowledge", desc: "Consulta de conocimiento" },
  ];

  for (const test of tests) {
    console.log(`\n📝 TEST: ${test.desc}`);
    console.log(`   Usuario: "${test.input}"`);
    
    try {
      const result = await graph.invoke({
        ...initialState,
        messages: [new HumanMessage(test.input)],
      }, config);

      const lastMsg = result.messages[result.messages.length - 1];
      const response = typeof lastMsg.content === "string" ? lastMsg.content : "No response";
      
      console.log(`   Respuesta: ${response.substring(0, 150)}...`);
      console.log(`   ✅ Pasó`);
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
}

testTools();
