// Sincroniza Pinecone con Firestore: elimina vectores huérfanos
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

async function syncPinecone() {
  if (!process.env.PINECONE_API_KEY) {
    console.log("❌ PINECONE_API_KEY no configurada");
    return;
  }

  // 1. Obtener datos válidos de Firestore
  const adminsSnap = await db.collection("admins").get();
  const validAdminIds = new Set(adminsSnap.docs.map(d => d.id));
  console.log(`✅ Admins válidos: ${[...validAdminIds].join(", ")}`);

  const agentsSnap = await db.collection("agents").get();
  const validAgentIds = new Set(
    agentsSnap.docs.filter(d => validAdminIds.has(d.data().clientId)).map(d => d.id)
  );
  console.log(`✅ Agentes válidos: ${validAgentIds.size}`);

  const docsSnap = await db.collection("knowledge_docs").get();
  const validDocIds = new Set(
    docsSnap.docs.filter(d => validAdminIds.has(d.data().clientId)).map(d => d.id)
  );
  console.log(`✅ Knowledge docs válidos: ${[...validDocIds].join(", ")}`);

  const partsSnap = await db.collection("knowledge_parts").get();
  const validPartIds = new Set(
    partsSnap.docs.filter(d => validDocIds.has(d.data().docId)).map(d => d.id)
  );
  console.log(`✅ Knowledge parts válidos: ${validPartIds.size}`);

  // 2. Conectar a Pinecone
  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const index = pinecone.index("chatbot-knowledge");
  const stats = await index.describeIndexStats();

  if (!stats.namespaces) {
    console.log("No hay namespaces en Pinecone");
    return;
  }

  console.log(`\n🌲 Pinecone namespaces: ${Object.keys(stats.namespaces).length}`);
  let totalDeleted = 0;

  for (const [ns, nsStats] of Object.entries(stats.namespaces)) {
    const vectorCount = (nsStats as any).recordCount || (nsStats as any).vectorCount || 0;
    console.log(`\n── Namespace: ${ns} (${vectorCount} vectores)`);

    // Namespaces globales — no tocar
    if (ns === "global_functions" || ns === "function_groups") {
      console.log("   ✅ Namespace global, se mantiene");
      continue;
    }

    // document_catalog — borrar vectores de docs que no existen
    if (ns === "document_catalog") {
      const toDelete: string[] = [];
      let paginationToken: string | undefined;

      do {
        const listResult = await index.namespace(ns).listPaginated({
          limit: 100,
          ...(paginationToken ? { paginationToken } : {}),
        });
        for (const v of listResult.vectors || []) {
          if (v.id && !validDocIds.has(v.id)) {
            toDelete.push(v.id);
          }
        }
        paginationToken = listResult.pagination?.next;
      } while (paginationToken);

      if (toDelete.length > 0) {
        await index.namespace(ns).deleteMany(toDelete);
        console.log(`   🗑️ ${toDelete.length} vectores huérfanos eliminados: ${toDelete.join(", ")}`);
        totalDeleted += toDelete.length;
      } else {
        console.log("   ✅ Todos los vectores son válidos");
      }
      continue;
    }

    // client_* namespaces — verificar adminId y limpiar vectores de docs eliminados
    if (ns.startsWith("client_")) {
      const clientId = ns.replace("client_", "");
      if (!validAdminIds.has(clientId)) {
        await index.namespace(ns).deleteAll();
        console.log(`   🗑️ Namespace completo eliminado (admin ${clientId} no existe)`);
        totalDeleted += vectorCount;
        continue;
      }

      // Admin válido — limpiar vectores de docs eliminados
      const toDelete: string[] = [];
      let paginationToken: string | undefined;

      do {
        const listResult = await index.namespace(ns).listPaginated({
          limit: 100,
          ...(paginationToken ? { paginationToken } : {}),
        });

        if (listResult.vectors && listResult.vectors.length > 0) {
          const ids = listResult.vectors.map(v => v.id!);
          // Fetch metadata to check docId
          const fetched = await index.namespace(ns).fetch(ids);
          for (const [id, record] of Object.entries(fetched.records || {})) {
            const docId = (record.metadata as any)?.docId;
            if (docId && !validDocIds.has(docId)) {
              toDelete.push(id);
            }
          }
        }
        paginationToken = listResult.pagination?.next;
      } while (paginationToken);

      if (toDelete.length > 0) {
        // Delete in batches of 100
        for (let i = 0; i < toDelete.length; i += 100) {
          await index.namespace(ns).deleteMany(toDelete.slice(i, i + 100));
        }
        console.log(`   🗑️ ${toDelete.length} vectores huérfanos eliminados`);
        totalDeleted += toDelete.length;
      } else {
        console.log("   ✅ Todos los vectores son válidos");
      }
      continue;
    }

    // history_* namespaces — verificar que el agente exista
    if (ns.startsWith("history_")) {
      const agentMatch = ns.match(/history_(agent_[a-f0-9-]+)_/);
      if (agentMatch && !validAgentIds.has(agentMatch[1])) {
        await index.namespace(ns).deleteAll();
        console.log(`   🗑️ Namespace eliminado (agente ${agentMatch[1]} no existe)`);
        totalDeleted += vectorCount;
        continue;
      }
      console.log("   ✅ Agente válido");
      continue;
    }

    // products_* namespaces — no se usan actualmente (products no se vectorizan)
    if (ns.startsWith("products_")) {
      const clientId = ns.replace("products_client_", "").replace("products_", "");
      if (!validAdminIds.has(clientId)) {
        await index.namespace(ns).deleteAll();
        console.log(`   🗑️ Namespace eliminado (admin ${clientId} no existe)`);
        totalDeleted += vectorCount;
      } else {
        console.log("   ✅ Admin válido");
      }
      continue;
    }

    console.log("   ⚠️ Namespace desconocido — se mantiene");
  }

  console.log(`\n📊 Total vectores eliminados: ${totalDeleted}`);
  console.log("✅ Sincronización Pinecone completa");
}

syncPinecone().catch(console.error);
