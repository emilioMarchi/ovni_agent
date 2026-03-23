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

async function testFullSchedulingFlow() {
    console.log("🚀 Iniciando prueba FLUJO COMPLETO (Proactivo -> Selección -> Confirmación)...");
    const config = { configurable: { thread_id: "test_full_" + Date.now() } };
    const clientId = "org_2d8f74a1-b9c5-4e2a-bb6d-f492a8e310d5";

    // Turno 1: Intención natural
    console.log("\n--- Turno 1: Usuario: 'Me gustaría coordinar una charla técnica' ---");
    const res1 = await graph.invoke({
        clientId,
        agentId: "agent_f2c43c56-2944-4f37-b7d5-b59427b47f09",
        messages: [new HumanMessage("Hola, me gustaría coordinar una charla técnica con ustedes")],
    }, config);
    console.log("Eva:", res1.messages[res1.messages.length - 1].content);

    // Turno 2: Usuario elige horario y da datos
    console.log("\n--- Turno 2: Usuario elige horario y da datos ---");
    const res2 = await graph.invoke({
        messages: [new HumanMessage("El miércoles 25 de marzo a las 10:00. Me llamo Juan Perez, juan@test.com")],
    }, config);
    console.log("Eva:", res2.messages[res2.messages.length - 1].content);

    // Verificar en DB
    const db = admin.firestore();
    const meetings = await db.collection("meetings").where("customerEmail", "==", "juan@test.com").get();
    if (!meetings.empty) {
        console.log("\n✅ ÉXITO: Reunión encontrada en Firestore!");
        meetings.forEach(m => console.log("   Data:", m.data()));
    } else {
        console.log("\n❌ ERROR: Reunión NO encontrada en Firestore.");
    }
}

testFullSchedulingFlow();
