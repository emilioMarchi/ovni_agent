import admin from "firebase-admin";
import fs from "fs";

const sa = JSON.parse(fs.readFileSync("./agent-firebase-service.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function main() {
  console.log("=== COLECCIÓN: admins ===\n");
  const snapshot = await db.collection("admins").get();
  if (snapshot.empty) {
    console.log("No hay admins.");
    process.exit(0);
  }
  for (const doc of snapshot.docs) {
    const d = doc.data();
    console.log(`🏢 Admin ID: ${doc.id}`);
    console.log(`   name: ${d.name}`);
    console.log(`   businessName: ${d.businessName || "(vacío)"}`);
    console.log(`   email: ${d.email}`);
    console.log(`   allowedDomains: ${JSON.stringify(d.allowedDomains || [])}`);
    console.log(`   hasSystemInstruction: ${!!d.systemInstruction}`);
    console.log(`   hasBusinessContext: ${!!d.businessContext}`);
    console.log(`   keys: [${Object.keys(d).join(", ")}]`);
    console.log("");
  }
  process.exit(0);
}
main();
