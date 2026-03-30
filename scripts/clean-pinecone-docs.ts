/**
 * Limpia vectores de documentos huérfanos en Pinecone.
 * Solo borra vectores de document_catalog y knowledge_parts (part_*),
 * NO toca nada más.
 *
 * Modo:  --dry-run (default) = solo lista lo que borraría
 *        --execute = borra efectivamente
 *
 * Uso: npx tsx scripts/clean-pinecone-docs.ts [--execute]
 */
import dotenv from "dotenv";
dotenv.config();

import admin from "firebase-admin";
import { Pinecone } from "@pinecone-database/pinecone";
import fs from "fs";

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(fs.readFileSync("./agent-firebase-service.json", "utf8"));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const INDEX_NAME = "chatbot-knowledge";
const dryRun = !process.argv.includes("--execute");

async function main() {
  console.log(dryRun ? "🔍 MODO DRY-RUN (no borra nada)\n" : "⚠️ MODO EJECUTAR (va a borrar)\n");

  const index = pinecone.index(INDEX_NAME);

  // 1. Obtener docIds que existen en Firestore
  const kDocsSnap = await db.collection("knowledge_docs").get();
  const existingDocIds = new Set(kDocsSnap.docs.map(d => d.id));
  console.log(`📄 Documentos en Firestore: ${existingDocIds.size}`);
  for (const id of existingDocIds) {
    console.log(`   ✅ ${id}`);
  }

  // 2. Obtener clientIds activos de admins
  const adminsSnap = await db.collection("admins").get();
  const clientIds = adminsSnap.docs.map(d => d.id);
  console.log(`\n👤 Clientes activos: ${clientIds.join(", ")}`);

  // 3. Revisar document_catalog namespace
  console.log("\n--- document_catalog ---");
  const catalogNs = index.namespace("document_catalog");
  
  // Listar vectores del catálogo usando un query dummy
  const catalogStats = await index.describeIndexStats();
  const catalogCount = catalogStats.namespaces?.["document_catalog"]?.recordCount || 0;
  console.log(`   Vectores totales en document_catalog: ${catalogCount}`);

  // Buscar todos los vectores del catálogo por clientId
  const catalogToDelete: string[] = [];
  for (const clientId of clientIds) {
    // Usar list si está disponible, sino fetch por IDs conocidos
    try {
      const listResult = await catalogNs.listPaginated({ prefix: "doc_" });
      const vectors = listResult.vectors?.map(v => v.id) || [];
      for (const vecId of vectors) {
        if (!existingDocIds.has(vecId)) {
          catalogToDelete.push(vecId);
          console.log(`   🗑️ Huérfano en catalog: ${vecId}`);
        } else {
          console.log(`   ✅ Válido: ${vecId}`);
        }
      }
      // Paginar si hay más
      let nextToken = listResult.pagination?.next;
      while (nextToken) {
        const page = await catalogNs.listPaginated({ prefix: "doc_", paginationToken: nextToken });
        const pageVecs = page.vectors?.map(v => v.id) || [];
        for (const vecId of pageVecs) {
          if (!existingDocIds.has(vecId)) {
            catalogToDelete.push(vecId);
            console.log(`   🗑️ Huérfano en catalog: ${vecId}`);
          } else {
            console.log(`   ✅ Válido: ${vecId}`);
          }
        }
        nextToken = page.pagination?.next;
      }
    } catch (e: any) {
      console.error(`   Error listando catalog: ${e.message}`);
    }
  }

  // 4. Revisar namespaces de clientes (part_* vectors)
  const partsToDelete: { namespace: string; ids: string[] }[] = [];
  for (const clientId of clientIds) {
    const ns = `client_${clientId}`;
    const nsCount = catalogStats.namespaces?.[ns]?.recordCount || 0;
    console.log(`\n--- ${ns} (${nsCount} vectores) ---`);

    if (nsCount === 0) continue;

    const orphanIds: string[] = [];
    try {
      let listResult = await index.namespace(ns).listPaginated({ prefix: "part_" });
      let vectors = listResult.vectors?.map(v => v.id) || [];
      
      for (const vecId of vectors) {
        // part_doc_XXXXX_N → extraer docId
        const match = vecId.match(/^part_(doc_\d+)_\d+$/);
        const docId = match?.[1];
        if (docId && !existingDocIds.has(docId)) {
          orphanIds.push(vecId);
        }
      }

      let nextToken = listResult.pagination?.next;
      while (nextToken) {
        const page = await index.namespace(ns).listPaginated({ prefix: "part_", paginationToken: nextToken });
        const pageVecs = page.vectors?.map(v => v.id) || [];
        for (const vecId of pageVecs) {
          const match = vecId.match(/^part_(doc_\d+)_\d+$/);
          const docId = match?.[1];
          if (docId && !existingDocIds.has(docId)) {
            orphanIds.push(vecId);
          }
        }
        nextToken = page.pagination?.next;
      }
    } catch (e: any) {
      console.error(`   Error listando ${ns}: ${e.message}`);
    }

    if (orphanIds.length > 0) {
      // Agrupar por docId para el log
      const byDoc = new Map<string, number>();
      for (const id of orphanIds) {
        const match = id.match(/^part_(doc_\d+)_\d+$/);
        const docId = match?.[1] || "unknown";
        byDoc.set(docId, (byDoc.get(docId) || 0) + 1);
      }
      for (const [docId, count] of byDoc) {
        console.log(`   🗑️ ${count} fragmentos huérfanos de ${docId}`);
      }
      partsToDelete.push({ namespace: ns, ids: orphanIds });
    } else {
      console.log(`   ✅ Sin huérfanos`);
    }
  }

  // 5. Resumen y ejecución
  const totalToDelete = catalogToDelete.length + partsToDelete.reduce((sum, p) => sum + p.ids.length, 0);
  console.log(`\n${"=".repeat(50)}`);
  console.log(`Total vectores a eliminar: ${totalToDelete}`);
  console.log(`   - document_catalog: ${catalogToDelete.length}`);
  for (const p of partsToDelete) {
    console.log(`   - ${p.namespace}: ${p.ids.length}`);
  }

  if (totalToDelete === 0) {
    console.log("\n✅ No hay nada que limpiar.");
    return;
  }

  if (dryRun) {
    console.log("\n💡 Ejecutá con --execute para borrar.");
    return;
  }

  // Borrar
  console.log("\n🗑️ Eliminando...");

  if (catalogToDelete.length > 0) {
    const BATCH = 100;
    for (let i = 0; i < catalogToDelete.length; i += BATCH) {
      const batch = catalogToDelete.slice(i, i + BATCH);
      await catalogNs.deleteMany(batch);
      console.log(`   ✅ Catalog: ${Math.min(i + BATCH, catalogToDelete.length)}/${catalogToDelete.length}`);
    }
  }

  for (const { namespace, ids } of partsToDelete) {
    const ns = index.namespace(namespace);
    const BATCH = 100;
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH);
      await ns.deleteMany(batch);
      console.log(`   ✅ ${namespace}: ${Math.min(i + BATCH, ids.length)}/${ids.length}`);
    }
  }

  console.log("\n✅ Limpieza completada.");
}

main().catch(console.error).finally(() => process.exit(0));
