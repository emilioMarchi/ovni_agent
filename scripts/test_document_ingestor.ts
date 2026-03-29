import path from "path";
import { fileURLToPath } from "url";
import { processAndIngestDocument } from "../src/utils/documentIngestor";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const filePath = path.resolve(__dirname, "../our-internal-systems-es.md");
  const clientId = "org_2d8f74a1-b9c5-4e2a-bb6d-f492a8e310d5";
  const docId = `doc_test_${Date.now()}`;
  const filename = "our-internal-systems-es.md";
  const description = "Documento traducido para ingesta";
  try {
    const result = await processAndIngestDocument({ filePath, clientId, docId, filename, description });
    console.log("Ingest result:", result);
  } catch (e) {
    console.error("Error in ingestion:", e);
  }
}

main();