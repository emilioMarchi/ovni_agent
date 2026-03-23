import dotenv from "dotenv";
import { HumanMessage } from "@langchain/core/messages";
import { graph } from "../src/graph/index.js";
import admin from "firebase-admin";
import fs from "fs";

dotenv.config();

// Inicializar Firebase
if (!admin.apps.length) {
    const serviceAccount = JSON.parse(fs.readFileSync("./agent-firebase-service.json", "utf8"));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

async function testProactiveScheduling() {
    console.log("🚀 Iniciando prueba: ¿Consulta proactivamente o alucina?");
    const config = { configurable: { thread_id: "test_proactive_" + Date.now() } };
    const clientId = "org_2d8f74a1-b9c5-4e2a-bb6d-f492a8e310d5";
    const agentId = "agent_f2c43c56-2944-4f37-b7d5-b59427b47f09";

    // Turno 1: Usuario pide reunión vaga
    console.log("\n--- Turno 1: Usuario: 'Quiero agendar una reunión' ---");
    const res1 = await graph.invoke({
        clientId, agentId,
        messages: [new HumanMessage("Quiero agendar una reunión")],
    }, config);
    
    const messages = res1.messages;
    const lastMsg = messages[messages.length - 1];
    
    // Verificamos si hubo una llamada a herramienta en este turno
    const hasToolCall = messages.some((m: any) => m.tool_calls && m.tool_calls.length > 0);
    
    console.log("Eva:", lastMsg.content);
    if (hasToolCall) {
        console.log("✅ ÉXITO: El agente llamó a la herramienta proactivamente.");
    } else {
        console.log("❌ FALLO: El agente respondió directamente sin consultar disponibilidad.");
    }
}

testProactiveScheduling();
