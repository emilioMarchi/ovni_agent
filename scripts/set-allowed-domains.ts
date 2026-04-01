import admin from "firebase-admin";
import fs from "fs";

const sa = JSON.parse(fs.readFileSync("./agent-firebase-service.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function main() {
  const clientId = "org_2d8f74a1-b9c5-4e2a-bb6d-f492a8e310d5";
  const allowedDomains = [
    "localhost",
    "localhost:3000",
    "127.0.0.1",
    "dev.ovnistudio.com.ar",
    "api.ovnistudio.com.ar",
    "*.ovnistudio.com.ar",
  ];

  await db.collection("admins").doc(clientId).update({ allowedDomains });
  console.log(`✅ allowedDomains actualizado para ${clientId}:`, allowedDomains);

  // Verify
  const doc = await db.collection("admins").doc(clientId).get();
  console.log("Verificación:", JSON.stringify(doc.data()?.allowedDomains));
  process.exit(0);
}
main();
