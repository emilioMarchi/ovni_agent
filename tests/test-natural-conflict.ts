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

async function testNaturalConflictFlow() {
    console.log("🚀 Iniciando prueba: Flujo Natural -> Conflicto de horario");
    const config = { configurable: { thread_id: "test_natural_" + Date.now() } };
    const clientId = "org_2d8f74a1-b9c5-4e2a-bb6d-f492a8e310d5";
    const agentId = "agent_f2c43c56-2944-4f37-b7d5-b59427b47f09";

    // 1. Usuario pide reunión de forma vaga
    console.log("\n--- Turno 1: Usuario: 'Quisiera coordinar una cita' ---");
    const res1 = await graph.invoke({
        clientId, agentId,
        messages: [new HumanMessage("Quisiera coordinar una cita")],
    }, config);
    console.log("Eva (Respuesta 1):", res1.messages[res1.messages.length - 1].content);

    // 2. Usuario intenta agendar el horario que ya sabemos ocupado (2026-03-25 10:00)
    console.log("\n--- Turno 2: Usuario intenta agendar 2026-03-25 a las 10:00 (Ocupado) ---");
    const res2 = await graph.invoke({
        messages: [new HumanMessage("Me gustaría el miércoles 25 de marzo a las 10:00. Soy Maria, maria@test.com")],
    }, config);
    console.log("Eva (Respuesta 2):", res2.messages[res2.messages.length - 1].content);
}

testNaturalConflictFlow();
