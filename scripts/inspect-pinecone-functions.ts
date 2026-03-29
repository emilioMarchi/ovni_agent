import "dotenv/config";
import { Pinecone } from "@pinecone-database/pinecone";

async function dumpNamespace(namespace: string) {
  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  const index = pinecone.index("chatbot-knowledge");

  console.log(`NAMESPACE=${namespace}`);

  let paginationToken: string | undefined;
  do {
    const page = await index.namespace(namespace).listPaginated({
      limit: 100,
      ...(paginationToken ? { paginationToken } : {}),
    });

    const ids = (page.vectors || []).map((vector) => vector.id).filter(Boolean) as string[];
    console.log(`IDS=${JSON.stringify(ids)}`);

    if (ids.length > 0) {
      const fetched = await index.namespace(namespace).fetch(ids);
      for (const [id, record] of Object.entries(fetched.records || {})) {
        console.log(JSON.stringify({ id, metadata: record.metadata }, null, 2));
      }
    }

    paginationToken = page.pagination?.next;
  } while (paginationToken);
}

async function main() {
  await dumpNamespace("global_functions");
  await dumpNamespace("function_groups");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
