// Utilidad para extraer texto plano de archivos según su tipo
// Soporta: txt, pdf, xlsx, json, md, doc, docx, csv

import fs from "fs";
import path from "path";
import markdownToTxtModule from "markdown-to-txt";
const markdownToTxt = markdownToTxtModule.markdownToTxt || markdownToTxtModule.default || markdownToTxtModule;

export async function extractTextFromFile(filePath: string, originalFilename?: string): Promise<string> {
  const sourceName = originalFilename || filePath;
  const ext = path.extname(sourceName).toLowerCase();

  switch (ext) {
    case ".txt":
    case ".csv": {
      return fs.readFileSync(filePath, "utf8");
    }

    case ".md": {
      const mdContent = fs.readFileSync(filePath, "utf8");
      return markdownToTxt(mdContent);
    }

    case ".pdf": {
      const pdfParse = (await import("pdf-parse")).default;
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return data.text;
    }

    case ".doc":
    case ".docx": {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    }

    case ".json": {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw);
      return flattenJsonToText(parsed);
    }

    case ".xlsx":
    case ".xls": {
      const XLSX = (await import("xlsx")).default || await import("xlsx");
      const workbook = XLSX.readFile(filePath);
      const sheets: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const text = XLSX.utils.sheet_to_csv(sheet);
        sheets.push(`--- Hoja: ${sheetName} ---\n${text}`);
      }
      return sheets.join("\n\n");
    }

    default:
      throw new Error(`Tipo de archivo no soportado: ${ext}. Formatos soportados: txt, md, pdf, doc, docx, json, xlsx, xls, csv`);
  }
}

function flattenJsonToText(obj: any, prefix = ""): string {
  if (typeof obj === "string") return obj;
  if (typeof obj === "number" || typeof obj === "boolean") return String(obj);
  if (Array.isArray(obj)) {
    return obj.map((item, i) => flattenJsonToText(item, `${prefix}[${i}]`)).join("\n");
  }
  if (obj && typeof obj === "object") {
    return Object.entries(obj)
      .map(([key, val]) => {
        const path = prefix ? `${prefix} > ${key}` : key;
        const text = flattenJsonToText(val, path);
        if (typeof val === "object" && val !== null) return `${path}:\n${text}`;
        return `${path}: ${text}`;
      })
      .join("\n");
  }
  return "";
}
