// Procesador central de documentos para extracción de texto
// Soporta: .md (Markdown), se puede extender para otros tipos
import { extractTextFromFile } from "./extractText.js";
import path from "path";
export async function processDocument(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".md") {
        return await extractTextFromFile(filePath);
    }
    // Aquí puedes agregar lógica para otros tipos (pdf, txt, etc.)
    throw new Error(`Tipo de archivo no soportado: ${ext}`);
}
//# sourceMappingURL=documentProcessor.js.map