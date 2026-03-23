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

async function testAvailabilityConflict() {
    console.log("🚀 Iniciando prueba de CONFLICTO DE HORARIO (Debería detectar que 10:00 ya está ocupado)...");
    const config = { configurable: { thread_id: "test_conflict_" + Date.now() } };
    const clientId = "org_2d8f74a1-b9c5-4e2a-bb6d-f492a8e310d5";

    // Intentamos agendar en el mismo horario ocupado anteriormente
    console.log("\n--- Turno 1: Usuario intenta agendar 10:00 (Ocupado) ---");
    const res = await graph.invoke({
        clientId,
        agentId: "agent_f2c43c56-2944-4f37-b7d5-b59427b47f09",
        messages: [new HumanMessage("Quiero agendar el miércoles 25 de marzo a las 10:00. Soy Maria, maria@test.com")],
    }, config);

    const lastMsg = res.messages[res.messages.length - 1];
    console.log("Eva:", lastMsg.content);

    // Verificar que NO haya una segunda reunión en ese horario
    const db = admin.firestore();
    const meetings = await db.collection("meetings")
        .where("date", "==", "2026-03-25")
        .where("time", "==", "10:00")
        .get();

    console.log(`\n📊 Reuniones encontradas en 2026-03-25 10:00: ${meetings.size}`);
    if (meetings.size > 1) {
        console.log("❌ FALLO: Se permitió agendar un horario ocupado.");
    } else {
        console.log("✅ ÉXITO: El agente bloqueó el horario o avisó que no estaba disponible.");
    }
}

testAvailabilityConflict();
