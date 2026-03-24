
import admin from "firebase-admin";
import { config } from "dotenv";
import { resolve } from "path";

// Cargar variables de entorno
config({ path: resolve(process.cwd(), ".env") });

// Inicializar Firebase si no está inicializado
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    console.error("Error inicializando Firebase:", error);
    process.exit(1);
  }
}

const db = admin.firestore();
const clientId = "org_2d8f74a1-b9c5-4e2a-bb6d-f492a8e310d5"; // El ID de tu log

async function checkTokens() {
  console.log(`🔍 Buscando tokens para Client ID: ${clientId}`);

  // 1. Revisar colección 'admins'
  const adminDoc = await db.collection("admins").doc(clientId).get();
  console.log("\n--- Colección 'admins' ---");
  if (adminDoc.exists) {
    const data = adminDoc.data();
    if (data?.googleCalendar?.tokens) {
      console.log("✅ Tokens ENCONTRADOS en 'admins'.");
      console.log("Tokens expiry:", data.googleCalendar.tokens.expiry_date);
    } else {
      console.log("❌ Documento existe, pero NO tiene tokens en googleCalendar.");
      console.log("Estructura googleCalendar:", data?.googleCalendar);
    }
  } else {
    console.log("❌ Documento NO encontrado en 'admins'.");
  }

  // 2. Revisar colección 'config'
  const configDoc = await db.collection("config").doc(clientId).get();
  console.log("\n--- Colección 'config' ---");
  if (configDoc.exists) {
    const data = configDoc.data();
    if (data?.googleCalendar?.tokens) {
      console.log("✅ Tokens ENCONTRADOS en 'config'.");
      console.log("Tokens expiry:", data.googleCalendar.tokens.expiry_date);
    } else {
      console.log("❌ Documento existe, pero NO tiene tokens en googleCalendar.");
      console.log("Estructura googleCalendar:", data?.googleCalendar);
    }
  } else {
    console.log("❌ Documento NO encontrado en 'config'.");
  }
}

checkTokens().catch(console.error);
