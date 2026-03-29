// Utilidad para extraer texto plano de archivos según su tipo
// Soporta: txt, pdf, xlsx, json, md

import fs from "fs";
import path from "path";
import markdownToTxtModule from "markdown-to-txt";
const markdownToTxt = markdownToTxtModule.markdownToTxt || markdownToTxtModule.default || markdownToTxtModule;

export async function extractTextFromFile(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".md") {
    const mdContent = fs.readFileSync(filePath, "utf8");
    return markdownToTxt(mdContent);
  }
  // ...aquí iría la lógica para otros tipos (pdf, txt, etc.)
  throw new Error(`Tipo de archivo no soportado: ${ext}`);
}
