import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import axios from "axios";
import { calculateCost, trackCost, type CostBreakdown } from "./degrabadorCosts.js";

const execFileAsync = promisify(execFile);

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
function getOpenRouterKey() { return process.env.OPENROUTER_API_KEY || ""; }
const ASSEMBLYAI_SCRIPT = path.join(process.cwd(), "scripts", "assemblyai_transcribe.py");
const WHISPER_SCRIPT = path.join(process.cwd(), "scripts", "whisper_transcribe.py");
const PYTHON_BIN = process.env.PYTHON_BIN || path.join(process.cwd(), "scripts", "venv", "Scripts", "python.exe");
const PYTHON_BIN_VENV2 = path.join(process.cwd(), "scripts", "venv2", "Scripts", "python.exe");

const MAX_FILE_SIZE_MB = 25;
const MAX_DURATION_MIN = 20;

export interface DegrabadorResult {
  markdown: string;
  rawTranscription?: string;
  costs?: CostBreakdown;
}

function getMediaDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 0);
    });
  });
}

function extractAudioFlac(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioCodec("flac")
      .audioChannels(1)
      .audioFrequency(16000)
      .format("flac")
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface AssemblyAIUtterance {
  speaker: string;
  start: number;
  end: number;
  text: string;
}

async function transcribeWithAssemblyAI(audioPath: string): Promise<{ utterances: AssemblyAIUtterance[]; fullText: string; language: string }> {
  let stdout = "";
  let stderr = "";

  try {
    const result = await execFileAsync(PYTHON_BIN_VENV2, [
      ASSEMBLYAI_SCRIPT,
      audioPath,
      "--language", "es",
    ], {
      timeout: 600000,
      maxBuffer: 50 * 1024 * 1024,
    });
    stdout = result.stdout.trim();
    stderr = result.stderr;
  } catch (err: any) {
    console.error(`[Degrabador] AssemblyAI exec error:`, {
      code: err.code,
      killed: err.killed,
      stderr: err.stderr?.slice(0, 1000),
      stdout: err.stdout?.slice(0, 1000),
    });
    throw new Error(`AssemblyAI falló: ${err.stderr?.slice(0, 300) || err.message}`);
  }

  if (stderr) {
    console.warn(`[Degrabador] AssemblyAI stderr:`, stderr.slice(0, 500));
  }

  const resultFile = stdout;
  if (!resultFile || !fs.existsSync(resultFile)) {
    throw new Error("AssemblyAI no generó archivo de resultado");
  }

  let result: any;
  try {
    const raw = fs.readFileSync(resultFile, "utf-8");
    result = JSON.parse(raw);
  } catch {
    throw new Error("Error leyendo resultado de AssemblyAI");
  } finally {
    try { fs.unlinkSync(resultFile); } catch {}
  }

  if (result.error) {
    throw new Error(`AssemblyAI: ${result.error}`);
  }

  if (!result.utterances || result.utterances.length === 0) {
    return { utterances: [], fullText: result.full_text || "", language: result.language || "es" };
  }

  const speakers = [...new Set(result.utterances.map((u: any) => u.speaker))];
  console.log(`[Degrabador] AssemblyAI detectó ${speakers.length} speakers: ${speakers.join(", ")}`);

  return {
    utterances: result.utterances,
    fullText: result.full_text,
    language: result.language,
  };
}

async function transcribeWithFasterWhisper(audioPath: string): Promise<string> {
  let stdout = "";
  let stderr = "";

  try {
    const result = await execFileAsync(PYTHON_BIN, [
      WHISPER_SCRIPT,
      audioPath,
      "--model", "small",
      "--language", "es",
    ], {
      timeout: 600000,
      maxBuffer: 50 * 1024 * 1024,
    });
    stdout = result.stdout.trim();
    stderr = result.stderr;
  } catch (err: any) {
    console.error(`[Degrabador] Whisper exec error:`, {
      code: err.code,
      killed: err.killed,
      stderr: err.stderr?.slice(0, 1000),
      stdout: err.stdout?.slice(0, 1000),
    });
    throw new Error(`Faster Whisper falló: ${err.stderr?.slice(0, 300) || err.message}`);
  }

  if (stderr) {
    console.warn(`[Degrabador] Whisper stderr:`, stderr.slice(0, 500));
  }

  const resultFile = stdout;
  if (!resultFile || !fs.existsSync(resultFile)) {
    throw new Error("Faster Whisper no generó archivo de resultado");
  }

  let result: any;
  try {
    const raw = fs.readFileSync(resultFile, "utf-8");
    result = JSON.parse(raw);
  } catch {
    throw new Error("Error leyendo resultado de Faster Whisper");
  } finally {
    try { fs.unlinkSync(resultFile); } catch {}
  }

  if (result.error) {
    throw new Error(`Faster Whisper: ${result.error}`);
  }

  if (!result.segments || result.segments.length === 0) {
    return "";
  }

  console.log(`[Degrabador] Whisper detectó idioma: ${result.language} (${result.language_probability})`);

  return result.segments
    .map((seg: any) => {
      const start = formatTime(seg.start);
      const end = formatTime(seg.end);
      return `[${start} - ${end}] ${seg.text}`;
    })
    .join("\n");
}

function buildDiarizedTranscription(utterances: AssemblyAIUtterance[]): string {
  return utterances
    .map((u) => {
      const start = formatTime(u.start);
      const end = formatTime(u.end);
      return `[${start} - ${end}] Speaker ${u.speaker}: ${u.text}`;
    })
    .join("\n");
}

async function processWithLLM(transcription: string, hasDiarization: boolean): Promise<string> {
  const systemPrompt = hasDiarization
    ? `Actuás como un analista de datos experto. Vas a recibir una transcripción que YA TIENE diarización realizada (speakers identificados como Speaker A, Speaker B, etc.) con marcas de tiempo [MM:SS].

Tu tarea es:
1. Generar un resumen ejecutivo conciso al inicio.
2. Re-formatear la transcripción manteniendo los speakers ya identificados.
3. Devolver la respuesta en Markdown estricto.

El formato de salida debe ser exactamente este:

# 📊 RESUMEN EJECUTIVO DE LA GRABACIÓN
*   **Tema Principal:** [Breve descripción]
*   **Puntos Clave / Accionables:**
    1. [Punto clave 1]
    2. [Punto clave 2]

---

# 🗣️ TRANSCRIPCIÓN DETALLADA (CON TIMESTAMPS Y DIARIZACIÓN)

**[MM:SS - MM:SS] Speaker A:**
"texto del diálogo"

**[MM:SS - MM:SS] Speaker B:**
"texto del diálogo"`

    : `Actuás como un transcriptor experto y analista de datos. Vas a recibir una transcripción cruda que contiene marcas de tiempo (minutos y segundos). Tu tarea consiste en:

Analizar el contexto semántico y el tono de las frases para separar los diálogos por interlocutores distintos (Interlocutor 1, Interlocutor 2, etc.).

Mantener estrictamente el formato de tiempo [MM:SS] al inicio de cada cambio de bloque de diálogo.

Al principio del documento, generar un resumen ejecutivo conciso con los puntos clave tratados.

Devolver la respuesta formateada estrictamente en Markdown sin agregar comentarios adicionales fuera de la estructura solicitada.

El formato de salida debe ser exactamente este:

# 📊 RESUMEN EJECUTIVO DE LA GRABACIÓN
*   **Tema Principal:** [Breve descripción de qué se trata]
*   **Puntos Clave / Accionables:**
    1. [Punto clave 1]
    2. [Punto clave 2]

---

# 🗣️ TRANSCRIPCIÓN DETALLADA (CON TIMESTAMPS Y DIARIZACIÓN)

**[MM:SS - MM:SS] Interlocutor 1:**
"texto del diálogo"

**[MM:SS - MM:SS] Interlocutor 2:**
"texto del diálogo"`;

  const models = [
    process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-super-120b-a12b:free",
    ...(process.env.OPENROUTER_FALLBACK_MODELS?.split(",") || []),
  ];

  for (const model of models) {
    try {
      const response = await axios.post(
        `${OPENROUTER_BASE_URL}/chat/completions`,
        {
          model: model.trim(),
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Transcripción con timestamps:\n\n${transcription}` },
          ],
          temperature: 0.3,
          max_tokens: 16384,
        },
        {
          headers: {
            Authorization: `Bearer ${getOpenRouterKey()}`,
            "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "",
            "X-Title": process.env.OPENROUTER_SITE_NAME || "OvniAgent",
          },
          timeout: 90000,
        }
      );

      return response.data.choices?.[0]?.message?.content || transcription;
    } catch (err: any) {
      console.error(`[Degrabador] Error con modelo ${model}:`, err.message);
      continue;
    }
  }

  console.warn("[Degrabador] Todos los modelos fallaron, devolviendo transcripción cruda formateada");
  return formatRawTranscription(transcription, hasDiarization);
}

function formatRawTranscription(raw: string, hasDiarization: boolean): string {
  const lines = raw.split("\n").filter(Boolean);
  let summary = "# 📊 RESUMEN EJECUTIVO DE LA GRABACIÓN\n";
  summary += "*   **Tema Principal:** Transcripción procesada (sin resumen automático)\n";
  summary += "*   **Puntos Clave / Accionables:**\n";
  summary += "    1. Ver transcripción completa abaixo\n\n---\n\n";
  summary += "# 🗣️ TRANSCRIPCIÓN DETALLADA (CON TIMESTAMPS Y DIARIZACIÓN)\n\n";

  for (const line of lines) {
    const match = line.match(/^\[(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\]\s*(.*)/);
    if (match) {
      const content = match[3];
      if (hasDiarization) {
        // Speaker label already in text (e.g. "Speaker A: Hola...")
        const speakerMatch = content.match(/^Speaker (\w+):\s*(.*)/);
        if (speakerMatch) {
          summary += `**[${match[1]} - ${match[2]}] Speaker ${speakerMatch[1]}:**\n"${speakerMatch[2]}"\n\n`;
        } else {
          summary += `**[${match[1]} - ${match[2]}] Interlocutor:**\n"${content}"\n\n`;
        }
      } else {
        summary += `**[${match[1]} - ${match[2]}] Interlocutor:**\n"${content}"\n\n`;
      }
    } else {
      summary += `"${line}"\n\n`;
    }
  }

  return summary;
}

export async function processDegrabador(
  inputPath: string,
  onProgress?: (stage: string, progress: number) => void
): Promise<DegrabadorResult> {
  const tempDir = path.join(path.dirname(inputPath), "degrabador_temp");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const ext = path.extname(inputPath).toLowerCase();
  const isVideo = [".mp4", ".avi", ".mov", ".mkv", ".webm", ".flv", ".wmv"].includes(ext);
  let audioPath = inputPath;

  try {
    onProgress?.("validating", 5);

    const fileSizeMB = fs.statSync(inputPath).size / (1024 * 1024);
    if (fileSizeMB > MAX_FILE_SIZE_MB) {
      throw new Error(`El archivo pesa ${fileSizeMB.toFixed(1)}MB. Máximo permitido: ${MAX_FILE_SIZE_MB}MB.`);
    }

    const duration = await getMediaDuration(inputPath);
    const durationMin = duration / 60;
    if (durationMin > MAX_DURATION_MIN) {
      throw new Error(`El archivo dura ${durationMin.toFixed(1)} minutos. Máximo permitido: ${MAX_DURATION_MIN} minutos.`);
    }

    onProgress?.("extracting_audio", 15);
    console.log(`[Degrabador] Extrayendo audio de video: ${ext}`);
    audioPath = path.join(tempDir, `audio_${Date.now()}.flac`);
    await extractAudioFlac(inputPath, audioPath);

    onProgress?.("transcribing", 30);
    let rawTranscription = "";
    let hasDiarization = false;
    let usedAssemblyAI = false;

    // Try AssemblyAI first (transcription + diarization in one call)
    if (process.env.ASSEMBLYAI_API_KEY) {
      console.log("[Degrabador] Transcribiendo con AssemblyAI (transcription + diarization)...");
      try {
        const assemblyResult = await transcribeWithAssemblyAI(audioPath);
        rawTranscription = buildDiarizedTranscription(assemblyResult.utterances);
        hasDiarization = assemblyResult.utterances.length > 0;
        usedAssemblyAI = true;
        console.log(`[Degrabador] AssemblyAI completado: ${assemblyResult.utterances.length} utterances, ${assemblyResult.utterances.length > 0 ? [...new Set(assemblyResult.utterances.map(u => u.speaker))].length : 0} speakers`);
      } catch (err: any) {
        console.warn(`[Degrabador] AssemblyAI falló, intentando con Faster Whisper: ${err.message}`);
      }
    }

    // Fallback to local Faster Whisper (no diarization)
    if (!rawTranscription) {
      console.log("[Degrabador] Transcribiendo con Faster Whisper (sin diarización)...");
      rawTranscription = await transcribeWithFasterWhisper(audioPath);
    }

    if (!rawTranscription.trim()) {
      throw new Error("No se detectó audio en el archivo. Verificá que tenga contenido de audio.");
    }

    onProgress?.("processing_llm", 70);
    console.log(`[Degrabador] Procesando con LLM (diarización=${hasDiarization})...`);
    const markdown = await processWithLLM(rawTranscription, hasDiarization);

    onProgress?.("completed", 100);
    console.log("[Degrabador] Proceso completado exitosamente");

    // Calculate costs
    const llmModel = process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-super-120b-a12b:free";
    const costs = calculateCost({
      audioDurationSeconds: duration,
      assemblyaiModel: "universal-3.5-pro",
      serviceType: "async",
      diarizationMode: hasDiarization ? "standard" : "none",
      llmProvider: "openrouter-free",
      llmModel,
    });

    // Track cumulative spending
    const cumulative = trackCost(costs);

    console.log(`[Degrabador] Costo estimado: ${costs.costFormatted} (acumulado: $${cumulative.totalCost.toFixed(4)})`);

    return { markdown, rawTranscription, costs };
  } finally {
    try {
      if (audioPath !== inputPath && fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  }
}
