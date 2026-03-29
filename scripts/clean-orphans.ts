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

async function cleanOrphans() {
  const validAdminIds = new Set<string>();
  const validAgentIds = new Set<string>();

  // 1. Obtener admins válidos
  const adminsSnap = await db.collection("admins").get();
  adminsSnap.docs.forEach(d => validAdminIds.add(d.id));
  console.log(`✅ Admins válidos: ${[...validAdminIds].join(", ")}`);

  // 2. Obtener agentes válidos (que pertenezcan a un admin existente)
  const agentsSnap = await db.collection("agents").get();
  const orphanAgentIds: string[] = [];
  for (const doc of agentsSnap.docs) {
    const clientId = doc.data().clientId;
    if (validAdminIds.has(clientId)) {
      validAgentIds.add(doc.id);
    } else {
      orphanAgentIds.push(doc.id);
      console.log(`🗑️ Agente huérfano: ${doc.id} (clientId: ${clientId} no existe)`);
    }
  }

  // 3. Obtener docIds válidos para el admin OVNI Studio
  const validDocIds = new Set<string>();
  const kDocsSnap = await db.collection("knowledge_docs").get();
  const orphanDocIds: string[] = [];
  for (const doc of kDocsSnap.docs) {
    const clientId = doc.data().clientId;
    if (validAdminIds.has(clientId)) {
      validDocIds.add(doc.id);
      console.log(`✅ Doc válido: ${doc.id} (${doc.data().filename})`);
    } else {
      orphanDocIds.push(doc.id);
      console.log(`🗑️ Doc huérfano: ${doc.id} (${doc.data().filename}, clientId: ${clientId})`);
    }
  }

  // --- BORRAR HUÉRFANOS DE FIRESTORE ---
  let totalDeleted = 0;

  // Borrar agentes huérfanos
  for (const id of orphanAgentIds) {
    await db.collection("agents").doc(id).delete();
    totalDeleted++;
  }
  console.log(`\n🗑️ Agentes huérfanos eliminados: ${orphanAgentIds.length}`);

  // Borrar agent_metadata huérfana
  const metaSnap = await db.collection("agent_metadata").get();
  let metaDeleted = 0;
  for (const doc of metaSnap.docs) {
    const agentId = doc.data().agentId;
    if (!validAgentIds.has(agentId)) {
      await doc.ref.delete();
      metaDeleted++;
      totalDeleted++;
    }
  }
  console.log(`🗑️ Agent metadata huérfana eliminada: ${metaDeleted}/${metaSnap.size}`);

  // Borrar knowledge_docs huérfanos
  for (const id of orphanDocIds) {
    await db.collection("knowledge_docs").doc(id).delete();
    totalDeleted++;
  }
  console.log(`🗑️ Knowledge docs huérfanos eliminados: ${orphanDocIds.length}`);

  // Borrar knowledge_parts huérfanas
  const partsSnap = await db.collection("knowledge_parts").get();
  let partsDeleted = 0;
  for (const doc of partsSnap.docs) {
    const docId = doc.data().docId;
    if (!validDocIds.has(docId)) {
      await doc.ref.delete();
      partsDeleted++;
      totalDeleted++;
    }
  }
  console.log(`🗑️ Knowledge parts huérfanas eliminadas: ${partsDeleted}/${partsSnap.size}`);

  // Borrar checkpoints huérfanos (todos — se regeneran)
  const cpSnap = await db.collection("checkpoints").get();
  for (const doc of cpSnap.docs) {
    await doc.ref.delete();
    totalDeleted++;
  }
  console.log(`🗑️ Checkpoints eliminados: ${cpSnap.size}`);

  // Borrar usage_logs de agentes eliminados
  const logsSnap = await db.collection("usage_logs").get();
  let logsDeleted = 0;
  for (const doc of logsSnap.docs) {
    const agentId = doc.data().agentId;
    if (!validAgentIds.has(agentId)) {
      await doc.ref.delete();
      logsDeleted++;
      totalDeleted++;
    }
  }
  console.log(`🗑️ Usage logs huérfanos eliminados: ${logsDeleted}/${logsSnap.size}`);

  // Borrar products de agentes eliminados
  const productsSnap = await db.collection("products").get();
  let productsDeleted = 0;
  for (const doc of productsSnap.docs) {
    const agentId = doc.data().agentId;
    // products usan agentId o clientId
    const clientId = doc.data().clientId;
    if (agentId && !validAgentIds.has(agentId)) {
      await doc.ref.delete();
      productsDeleted++;
      totalDeleted++;
    } else if (clientId && !validAdminIds.has(clientId) && !agentId) {
      await doc.ref.delete();
      productsDeleted++;
      totalDeleted++;
    }
  }
  console.log(`🗑️ Products huérfanos eliminados: ${productsDeleted}/${productsSnap.size}`);

  // Borrar oauth_temp huérfanos
  const oauthSnap = await db.collection("oauth_temp").get();
  let oauthDeleted = 0;
  for (const doc of oauthSnap.docs) {
    const clientId = doc.data().clientId;
    if (!validAdminIds.has(clientId)) {
      await doc.ref.delete();
      oauthDeleted++;
      totalDeleted++;
    }
  }
  console.log(`🗑️ OAuth temp huérfanos eliminados: ${oauthDeleted}/${oauthSnap.size}`);

  console.log(`\n📊 Total documentos eliminados de Firestore: ${totalDeleted}`);

  // --- LIMPIAR PINECONE ---
  console.log("\n🌲 Limpiando Pinecone...");
  if (!process.env.PINECONE_API_KEY) {
    console.log("❌ PINECONE_API_KEY no configurada");
    return;
  }

  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const index = pinecone.index("chatbot-knowledge");
  const stats = await index.describeIndexStats();

  if (stats.namespaces) {
    let nsDeleted = 0;
    for (const ns of Object.keys(stats.namespaces)) {
      // Mantener: global_functions, function_groups, document_catalog
      if (["global_functions", "function_groups", "document_catalog"].includes(ns)) continue;

      // Verificar client_ namespaces
      if (ns.startsWith("client_")) {
        const clientId = ns.replace("client_", "");
        if (!validAdminIds.has(clientId)) {
          console.log(`🗑️ Pinecone namespace huérfano: ${ns}`);
          await index.namespace(ns).deleteAll();
          nsDeleted++;
        }
        continue;
      }

      // Verificar history_ namespaces
      if (ns.startsWith("history_")) {
        // Formato: history_{agentId}_{userId}
        const parts = ns.replace("history_", "").split("_");
        // agentId es como "agent_36263ce8-2013-438c-bd30-728d9a18b298"
        // Reconstruir agentId buscando el patrón
        const agentMatch = ns.match(/history_(agent_[a-f0-9-]+)_/);
        if (agentMatch) {
          const agentId = agentMatch[1];
          if (!validAgentIds.has(agentId)) {
            console.log(`🗑️ Pinecone namespace huérfano: ${ns}`);
            await index.namespace(ns).deleteAll();
            nsDeleted++;
          }
        }
        continue;
      }

      // Verificar products_ namespaces
      if (ns.startsWith("products_client_")) {
        const clientId = ns.replace("products_client_", "");
        if (!validAdminIds.has(clientId)) {
          console.log(`🗑️ Pinecone namespace huérfano: ${ns}`);
          await index.namespace(ns).deleteAll();
          nsDeleted++;
        }
        continue;
      }
    }
    console.log(`\n🌲 Pinecone namespaces huérfanos limpiados: ${nsDeleted}`);

    // Limpiar document_catalog de docs huérfanos
    if (orphanDocIds.length > 0) {
      try {
        await index.namespace("document_catalog").deleteMany(orphanDocIds);
        console.log(`🗑️ document_catalog: ${orphanDocIds.length} vectores huérfanos eliminados`);
      } catch (e) {
        console.log("⚠️ No se pudieron limpiar vectores de document_catalog (puede que no existieran)");
      }
    }
  }

  console.log("\n✅ Limpieza completa.");
}

cleanOrphans().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
