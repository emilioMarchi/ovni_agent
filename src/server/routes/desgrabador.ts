import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { processDesgrabador } from "../../services/desgrabadorService.js";
import { estimateCost } from "../../services/desgrabadorCosts.js";
import { masterAuth } from "../middleware/auth.js";
import { tokenOrFallback } from "../middleware/tokenAuth.js";

const router = Router();
router.use(tokenOrFallback(masterAuth));

const RESULTS_DIR = path.join(process.cwd(), "uploads", "desgrabador_results");
if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

const ALLOWED_EXTENSIONS = [
  ".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a", ".wma",
  ".mp4", ".avi", ".mov", ".mkv", ".webm", ".flv", ".wmv",
];

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Formato no soportado: ${ext}. Soportados: ${ALLOWED_EXTENSIONS.join(", ")}`));
    }
  },
});

interface Job {
  id: string;
  status: "processing" | "completed" | "error";
  filename: string;
  markdown?: string;
  rawTranscription?: string;
  costs?: any;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

const jobs = new Map<string, Job>();

// Estimate cost before uploading (accepts duration in seconds)
router.post("/estimate", (req: Request, res: Response) => {
  const { durationSeconds } = req.body;
  if (!durationSeconds || typeof durationSeconds !== "number" || durationSeconds <= 0) {
    return res.status(400).json({ success: false, error: "durationSeconds es requerido y debe ser > 0" });
  }
  const estimate = estimateCost(durationSeconds);
  res.json({ success: true, estimate });
});

// Upload → returns jobId immediately, processes in background
router.post("/", upload.single("file"), async (req: Request, res: Response) => {
  const file = (req as any).file;
  if (!file) {
    return res.status(400).json({ success: false, error: "No se envió archivo" });
  }

  const jobId = `job_${Date.now()}_${uuidv4().slice(0, 8)}`;
  const job: Job = {
    id: jobId,
    status: "processing",
    filename: file.originalname,
    createdAt: new Date().toISOString(),
  };
  jobs.set(jobId, job);

  console.log(`[Desgrabador] Job ${jobId} creado: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);

  // Return immediately
  res.status(202).json({ success: true, jobId, status: "processing" });

  // Process in background (no await)
  void (async () => {
    const tempPath = file.path;
    try {
      const result = await processDesgrabador(tempPath);

      job.status = "completed";
      job.markdown = result.markdown;
      job.rawTranscription = result.rawTranscription;
      job.costs = result.costs;
      job.completedAt = new Date().toISOString();

      // Save to disk
      const resultFile = path.join(RESULTS_DIR, `${jobId}.json`);
      fs.writeFileSync(resultFile, JSON.stringify(job, null, 2), "utf-8");
      console.log(`[Desgrabador] Job ${jobId} completado. Guardado en ${resultFile}`);
    } catch (error: any) {
      job.status = "error";
      job.error = error.message || "Error desconocido";
      job.completedAt = new Date().toISOString();

      const resultFile = path.join(RESULTS_DIR, `${jobId}.json`);
      fs.writeFileSync(resultFile, JSON.stringify(job, null, 2), "utf-8");
      console.error(`[Desgrabador] Job ${jobId} falló:`, error.message);
    } finally {
      try { fs.unlinkSync(tempPath); } catch {}
    }
  })();
});

// Poll → get job status/result
router.get("/:jobId", (req: Request, res: Response) => {
  const safeJobId = path.basename(req.params.jobId);
  const job = jobs.get(safeJobId);

  if (!job) {
    // Try loading from disk
    const resultFile = path.join(RESULTS_DIR, `${safeJobId}.json`);
    if (fs.existsSync(resultFile)) {
      const data = JSON.parse(fs.readFileSync(resultFile, "utf-8"));
      return res.json({ success: true, data });
    }
    return res.status(404).json({ success: false, error: "Job no encontrado" });
  }

  res.json({ success: true, data: job });
});

export default router;