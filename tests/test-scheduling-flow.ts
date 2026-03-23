import dotenv from "dotenv";
import { HumanMessage } from "@langchain/core/messages";
import { graph } from "../src/graph/index.js";
import admin from "firebase-admin";
import fs from "fs";

dotenv.config();

// 1. Inicializar Firebase Admin si no está inicializado
if (!admin.apps.length) {
  try {
    const serviceAccountPath = "./agent-firebase-service.json";
    if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
    } else {
        console.warn("⚠️ No se encontró agent-firebase-service.json. La prueba podría fallar si requiere Auth real.");
        // Fallback para entornos donde ya esté inicializado por otra vía o no se requiera escritura crítica
    }
  } catch (e) {
      console.error("Error init firebase:", e);
  }
}

/**
 * Prueba del Flujo de Agendado Proactivo.
 */
async function testSchedulingFlow() {
  console.log("🚀 Iniciando prueba de Agendado Proactivo...");

  const config = {
    configurable: {
      thread_id: "test_scheduling_" + Date.now(),
    },
  };

  // Usamos IDs que sabemos que existen (del test anterior)
  // Asegúrate de que este agente tenga el skill 'calendar' y function 'appointment_manager' en Firestore
  const initialState = {
    clientId: "org_2d8f74a1-b9c5-4e2a-bb6d-f492a8e310d5",
    agentId: "agent_f2c43c56-2944-4f37-b7d5-b59427b47f09", 
    messages: [
      new HumanMessage("Hola, me gustaría agendar una reunión con ustedes."),
    ],
  };

  try {
    console.log("\n--- Turno 1: Usuario pide reunión (Esperamos check_next_days automático) ---");
    // Invocamos el grafo
    const result1 = await graph.invoke(initialState, config);
    
    // Analizamos los mensajes para ver si hubo tool_calls
    const messages = result1.messages;
    const toolCalls = messages.flatMap((m: any) => m.tool_calls || []);
    
    console.log(`📊 Total mensajes en historial: ${messages.length}`);
    
    if (toolCalls.length > 0) {
        console.log("✅ Se detectaron llamadas a herramientas:");
        toolCalls.forEach((tc: any) => {
            console.log(`   - Tool: ${tc.name}`);
            console.log(`   - Args:`, tc.args);
        });

        const hasCheckNextDays = toolCalls.some((tc: any) => tc.name === "appointment_manager" && tc.args.action === "check_next_days");
        
        if (hasCheckNextDays) {
            console.log("\n✨ ÉXITO: El agente consultó proactivamente la disponibilidad.");
        } else {
            console.log("\n⚠️ ALERTA: El agente usó herramientas pero NO check_next_days como se esperaba.");
        }

    } else {
        console.log("❌ FALLO: El agente NO usó ninguna herramienta. Respondió directamente.");
    }

    const lastMsg = messages[messages.length - 1];
    console.log("\n💬 Respuesta final del Agente:\n", lastMsg.content);

  } catch (error) {
    console.error("❌ Error durante la prueba:", error);
  }
}

testSchedulingFlow();
