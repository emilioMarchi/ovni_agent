import admin from "firebase-admin";
import { Pinecone } from "@pinecone-database/pinecone";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(fs.readFileSync("./agent-firebase-service.json", "utf8"));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
admin.firestore().settings({ ignoreUndefinedProperties: true });

const db = admin.firestore();

function printFields(data: any, indent = "  ") {
  for (const [key, value] of Object.entries(data)) {
    const type = Array.isArray(value) ? `array(${(value as any[]).length})` : typeof value;
    let preview = "";
    if (typeof value === "string") preview = ` → "${value.substring(0, 120)}${value.length > 120 ? "..." : ""}"`;
    else if (typeof value === "number" || typeof value === "boolean") preview = ` → ${value}`;
    else if (Array.isArray(value)) preview = ` → ${JSON.stringify(value).substring(0, 150)}`;
    else if (value && typeof value === "object") preview = ` → ${JSON.stringify(value).substring(0, 150)}`;
    console.log(`${indent}${key} (${type})${preview}`);
  }
}

async function listAllCollections() {
  console.log("\n" + "=".repeat(80));
  console.log("📂 FIRESTORE - TODAS LAS COLECCIONES");
  console.log("=".repeat(80));

  const collections = await db.listCollections();
  console.log(`\nColecciones encontradas: ${collections.length}`);
  for (const col of collections) {
    console.log(`  → ${col.id}`);
  }
  return collections;
}

async function inspectCollection(collectionName: string, limit = 3) {
  console.log(`\n${"─".repeat(80)}`);
  console.log(`📁 COLECCIÓN: ${collectionName}`);
  console.log(`${"─".repeat(80)}`);

  const countSnapshot = await db.collection(collectionName).count().get();
  const totalDocs = countSnapshot.data().count;
  console.log(`Total documentos: ${totalDocs}`);

  const snapshot = await db.collection(collectionName).limit(limit).get();
  if (snapshot.empty) {
    console.log("  (vacía)");
    return;
  }

  for (const doc of snapshot.docs) {
    console.log(`\n  📄 Doc ID: ${doc.id}`);
    const data = doc.data();
    printFields(data, "    ");

    // Check for subcollections
    const subcollections = await doc.ref.listCollections();
    if (subcollections.length > 0) {
      console.log(`    📂 Subcolecciones: ${subcollections.map(s => s.id).join(", ")}`);
      for (const sub of subcollections) {
        const subSnapshot = await sub.limit(1).get();
        if (!subSnapshot.empty) {
          console.log(`      📁 ${sub.id} (ejemplo):`);
          printFields(subSnapshot.docs[0].data(), "        ");
        }
      }
    }
  }
}

async function inspectPinecone() {
  console.log("\n\n" + "=".repeat(80));
  console.log("🌲 PINECONE - ESTRUCTURA");
  console.log("=".repeat(80));

  if (!process.env.PINECONE_API_KEY) {
    console.log("❌ PINECONE_API_KEY no configurada");
    return;
  }

  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

  // List all indexes
  const indexList = await pinecone.listIndexes();
  console.log(`\nÍndices encontrados: ${indexList.indexes?.length || 0}`);
  
  if (indexList.indexes) {
    for (const idx of indexList.indexes) {
      console.log(`\n  🗂️  Index: ${idx.name}`);
      console.log(`     Host: ${idx.host}`);
      console.log(`     Dimension: ${idx.dimension}`);
      console.log(`     Metric: ${idx.metric}`);
      console.log(`     Status: ${JSON.stringify(idx.status)}`);

      // Get index stats with namespaces
      const index = pinecone.index(idx.name);
      const stats = await index.describeIndexStats();
      console.log(`     Total vectores: ${stats.totalRecordCount}`);
      console.log(`     Namespaces:`);
      
      if (stats.namespaces) {
        for (const [nsName, nsData] of Object.entries(stats.namespaces)) {
          console.log(`       → "${nsName}": ${nsData.recordCount} vectores`);
          
          // Fetch a sample vector from this namespace to see metadata structure
          try {
            // Use a dummy query to get sample vectors with metadata
            const dummyVector = new Array(idx.dimension).fill(0);
            dummyVector[0] = 1;
            const sampleResults = await index.namespace(nsName).query({
              vector: dummyVector,
              topK: 1,
              includeMetadata: true,
            });
            if (sampleResults.matches && sampleResults.matches.length > 0) {
              const sample = sampleResults.matches[0];
              console.log(`         Ejemplo vector ID: ${sample.id}`);
              console.log(`         Metadata fields:`);
              if (sample.metadata) {
                for (const [k, v] of Object.entries(sample.metadata)) {
                  const val = typeof v === "string" ? `"${v.substring(0, 100)}${v.length > 100 ? "..." : ""}"` : v;
                  console.log(`           ${k}: ${val}`);
                }
              }
            }
          } catch (e: any) {
            console.log(`         (No se pudo obtener muestra: ${e.message})`);
          }
        }
      }
    }
  }
}

async function main() {
  try {
    // 1. List all Firestore collections
    const collections = await listAllCollections();

    // 2. Inspect each collection
    for (const col of collections) {
      await inspectCollection(col.id, 2);
    }

    // 3. Inspect Pinecone
    await inspectPinecone();

    console.log("\n\n✅ Debug completo.");
  } catch (err) {
    console.error("❌ Error:", err);
  }
  process.exit(0);
}

main();
