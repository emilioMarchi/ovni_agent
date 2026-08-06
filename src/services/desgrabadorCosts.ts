/**
 * Cost Calculator for Desgrabador Pipeline
 *
 * AssemblyAI pricing (per-second billing):
 * ┌─────────────────────────────────┬──────────────┬──────────────┐
 * │ Component                       │ Async (batch)│ Realtime     │
 * ├─────────────────────────────────┼──────────────┼──────────────┤
 * │ Universal-3.5 Pro (base)        │ $0.21/hr     │ $0.45/hr     │
 * │ Universal-2 (base)              │ $0.15/hr     │ $0.30/hr     │
 * │ Speaker Diarization (standard)  │ +$0.02/hr    │ +$0.12/hr    │
 * │ Speaker Diarization (experimental)│ +$0.065/hr │ —            │
 * │ PII Redaction                   │ +$0.08/hr    │ +$0.10/hr    │
 * │ Sentiment Analysis              │ +$0.01/hr    │ —            │
 * │ Key Phrases                     │ +$0.01/hr    │ —            │
 * │ Summarization                   │ +$0.03/hr    │ —            │
 * │ Entity Detection                │ +$0.02/hr    │ —            │
 * └─────────────────────────────────┴──────────────┴──────────────┘
 *
 * LLM pricing (OpenRouter free models): $0.00
 *
 * Sources:
 * - https://www.assemblyai.com/pricing (consulted 2026-07-15)
 * - https://www.assemblyai.com/blog/speech-to-text-api-pricing-2026
 */

// ── Types ──────────────────────────────────────────────────────

export type AssemblyAIModel = "universal-3.5-pro" | "universal-2";
export type ServiceType = "async" | "realtime";
export type DiarizationMode = "standard" | "experimental" | "none";
export type LLMProvider = "openrouter-free" | "openrouter-paid" | "local";

// ── Rate Table ─────────────────────────────────────────────────

const RATES = {
  assemblyai: {
    transcription: {
      async: {
        "universal-3.5-pro": 0.21,
        "universal-2": 0.15,
      } as Record<AssemblyAIModel, number>,
      realtime: {
        "universal-3.5-pro": 0.45,
        "universal-2": 0.30,
      } as Record<AssemblyAIModel, number>,
    },
    diarization: {
      async: {
        standard: 0.02,
        experimental: 0.065,
        none: 0,
      } as Record<DiarizationMode, number>,
      realtime: {
        standard: 0.12,
        experimental: 0.12,
        none: 0,
      } as Record<DiarizationMode, number>,
    },
    // Extra features (async only, not available in realtime)
    extras: {
      pii_redaction: { async: 0.08, realtime: 0.10 },
      sentiment: { async: 0.01, realtime: 0 },
      key_phrases: { async: 0.01, realtime: 0 },
      summarization: { async: 0.03, realtime: 0 },
      entity_detection: { async: 0.02, realtime: 0 },
    } as Record<string, { async: number; realtime: number }>,
  },
  llm: {
    "openrouter-free": { input: 0, output: 0 },
    "openrouter-paid": { input: 0.50 / 1_000_000, output: 1.50 / 1_000_000 },
    "local": { input: 0, output: 0 },
  } as Record<LLMProvider, { input: number; output: number }>,
};

// Free models on OpenRouter (as of 2026)
const FREE_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-4-31b-it:free",
];

// ── Interfaces ─────────────────────────────────────────────────

export interface ExtraFeatures {
  pii_redaction?: boolean;
  sentiment?: boolean;
  key_phrases?: boolean;
  summarization?: boolean;
  entity_detection?: boolean;
}

export interface CostBreakdown {
  serviceType: ServiceType;
  audioDurationSeconds: number;
  audioDurationMinutes: number;
  audioDurationHours: number;

  assemblyai: {
    model: AssemblyAIModel;
    serviceType: ServiceType;
    transcriptionRate: number;
    diarizationMode: DiarizationMode;
    diarizationRate: number;
    extras: Record<string, { enabled: boolean; rate: number; cost: number }>;
    totalRate: number;
    transcriptionCost: number;
    diarizationCost: number;
    extrasCost: number;
    totalCost: number;
  };

  llm: {
    provider: LLMProvider;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
  };

  totalCost: number;
  costPerMinute: number;
  costFormatted: string;
  freeCreditRemaining?: number;  // AssemblyAI $50 credit
}

export interface CumulativeSpend {
  totalAudioSeconds: number;
  totalAudioHours: number;
  assemblyaiCost: number;
  llmCost: number;
  totalCost: number;
  jobCount: number;
  lastUpdated: string;
}

// ── Cost Calculator ─────────────────────────────────────────────

export function calculateCost(params: {
  audioDurationSeconds: number;
  assemblyaiModel?: AssemblyAIModel;
  serviceType?: ServiceType;
  diarizationMode?: DiarizationMode;
  extras?: ExtraFeatures;
  llmProvider?: LLMProvider;
  llmModel?: string;
  llmInputTokens?: number;
  llmOutputTokens?: number;
}): CostBreakdown {
  const {
    audioDurationSeconds,
    assemblyaiModel = "universal-3.5-pro",
    serviceType = "async",
    diarizationMode = "standard",
    extras = {},
    llmProvider = "openrouter-free",
    llmModel = "",
    llmInputTokens = 0,
    llmOutputTokens = 0,
  } = params;

  const hours = audioDurationSeconds / 3600;
  const minutes = audioDurationSeconds / 60;

  // AssemblyAI base costs
  const transcriptionRate = RATES.assemblyai.transcription[serviceType][assemblyaiModel];
  const diarizationRate = RATES.assemblyai.diarization[serviceType][diarizationMode];

  const transcriptionCost = transcriptionRate * hours;
  const diarizationCost = diarizationRate * hours;

  // AssemblyAI extras
  const extrasBreakdown: Record<string, { enabled: boolean; rate: number; cost: number }> = {};
  let extrasCost = 0;
  for (const [key, enabled] of Object.entries(extras)) {
    if (enabled && RATES.assemblyai.extras[key]) {
      const rate = RATES.assemblyai.extras[key][serviceType];
      const cost = rate * hours;
      extrasBreakdown[key] = { enabled: true, rate, cost };
      extrasCost += cost;
    }
  }

  const totalAssemblyAIRate = transcriptionRate + diarizationRate;
  const assemblyaiTotalCost = transcriptionCost + diarizationCost + extrasCost;

  // LLM costs
  let llmCost = 0;
  const isFreeModel = FREE_MODELS.some(m => llmModel.includes(m.split(":")[0]));
  const effectiveProvider = isFreeModel ? "openrouter-free" : llmProvider;

  if (effectiveProvider === "openrouter-paid") {
    const { input, output } = RATES.llm[effectiveProvider];
    llmCost = (llmInputTokens * input) + (llmOutputTokens * output);
  }

  const totalCost = assemblyaiTotalCost + llmCost;
  const costPerMinute = minutes > 0 ? totalCost / minutes : 0;

  // AssemblyAI $50 free credit (one-time, not monthly)
  const ASSEMBLYAI_FREE_CREDIT = 50;
  const freeCreditRemaining = Math.max(0, ASSEMBLYAI_FREE_CREDIT - assemblyaiTotalCost);

  return {
    serviceType,
    audioDurationSeconds,
    audioDurationMinutes: minutes,
    audioDurationHours: hours,

    assemblyai: {
      model: assemblyaiModel,
      serviceType,
      transcriptionRate,
      diarizationMode,
      diarizationRate,
      extras: extrasBreakdown,
      totalRate: totalAssemblyAIRate,
      transcriptionCost: round6(transcriptionCost),
      diarizationCost: round6(diarizationCost),
      extrasCost: round6(extrasCost),
      totalCost: round6(assemblyaiTotalCost),
    },

    llm: {
      provider: effectiveProvider,
      model: llmModel,
      inputTokens: llmInputTokens,
      outputTokens: llmOutputTokens,
      cost: round6(llmCost),
    },

    totalCost: round6(totalCost),
    costPerMinute: round6(costPerMinute),
    costFormatted: `$${totalCost.toFixed(4)}`,
    freeCreditRemaining: round6(freeCreditRemaining),
  };
}

// ── Cumulative Spending Tracker ────────────────────────────────

import fs from "fs";
import path from "path";

const SPEND_FILE = path.join(process.cwd(), "uploads", "desgrabador_spend.json");

function loadSpend(): CumulativeSpend {
  try {
    if (fs.existsSync(SPEND_FILE)) {
      return JSON.parse(fs.readFileSync(SPEND_FILE, "utf-8"));
    }
  } catch {}
  return {
    totalAudioSeconds: 0,
    totalAudioHours: 0,
    assemblyaiCost: 0,
    llmCost: 0,
    totalCost: 0,
    jobCount: 0,
    lastUpdated: new Date().toISOString(),
  };
}

function saveSpend(spend: CumulativeSpend): void {
  const dir = path.dirname(SPEND_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SPEND_FILE, JSON.stringify(spend, null, 2), "utf-8");
}

export function trackCost(costs: CostBreakdown): CumulativeSpend {
  const spend = loadSpend();
  spend.totalAudioSeconds += costs.audioDurationSeconds;
  spend.totalAudioHours += costs.audioDurationHours;
  spend.assemblyaiCost += costs.assemblyai.totalCost;
  spend.llmCost += costs.llm.cost;
  spend.totalCost += costs.totalCost;
  spend.jobCount += 1;
  spend.lastUpdated = new Date().toISOString();
  saveSpend(spend);
  return spend;
}

export function getSpend(): CumulativeSpend {
  return loadSpend();
}

// ── Quick Estimate (before upload) ─────────────────────────────

export function estimateCost(durationSeconds: number): {
  assemblyai: string;
  total: string;
  perMinute: string;
  creditRemaining: string;
} {
  const hours = durationSeconds / 3600;
  const rate = 0.21 + 0.02; // Universal-3.5 Pro + Diarization standard (async)
  const cost = rate * hours;
  const perMinute = durationSeconds > 0 ? cost / (durationSeconds / 60) : 0;
  const spend = loadSpend();
  const creditRemaining = Math.max(0, 50 - spend.assemblyaiCost - cost);

  return {
    assemblyai: `$${cost.toFixed(4)}`,
    total: `$${cost.toFixed(4)}`,
    perMinute: `$${perMinute.toFixed(6)}/min`,
    creditRemaining: `$${creditRemaining.toFixed(2)} de $50.00`,
  };
}

// ── Formatting ─────────────────────────────────────────────────

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

export function formatCostSummary(breakdown: CostBreakdown, cumulative?: CumulativeSpend): string {
  const lines = [
    `Costo total: ${breakdown.costFormatted}`,
    ``,
    `AssemblyAI (${breakdown.assemblyai.model}, ${breakdown.assemblyai.serviceType}):`,
    `  Transcripción: $${breakdown.assemblyai.transcriptionCost.toFixed(4)} (${breakdown.assemblyai.transcriptionRate}/hr × ${breakdown.audioDurationHours.toFixed(4)} hr)`,
    `  Diarización (${breakdown.assemblyai.diarizationMode}): $${breakdown.assemblyai.diarizationCost.toFixed(4)}`,
  ];

  if (breakdown.assemblyai.extrasCost > 0) {
    for (const [key, info] of Object.entries(breakdown.assemblyai.extras)) {
      if (info.enabled) {
        lines.push(`  ${key}: $${info.cost.toFixed(4)} (${info.rate}/hr)`);
      }
    }
  }

  lines.push(`  Subtotal AssemblyAI: $${breakdown.assemblyai.totalCost.toFixed(4)}`);
  lines.push(``);
  lines.push(`LLM (${breakdown.llm.provider}):`);
  lines.push(`  Modelo: ${breakdown.llm.model || "N/A"}`);
  lines.push(`  Costo: $${breakdown.llm.cost.toFixed(4)}`);
  lines.push(``);
  lines.push(`Duración audio: ${breakdown.audioDurationMinutes.toFixed(1)} min (${breakdown.audioDurationHours.toFixed(4)} hr)`);
  lines.push(`Costo por minuto: $${breakdown.costPerMinute.toFixed(6)}`);
  lines.push(`Crédito free AssemblyAI restante: ~$${(breakdown.freeCreditRemaining ?? 0).toFixed(2)}`);

  if (cumulative) {
    lines.push(``);
    lines.push(`── Acumulado total (${cumulative.jobCount} jobs) ──`);
    lines.push(`  Audio procesado: ${cumulative.totalAudioHours.toFixed(2)} hr`);
    lines.push(`  AssemblyAI: $${cumulative.assemblyaiCost.toFixed(4)}`);
    lines.push(`  LLM: $${cumulative.llmCost.toFixed(4)}`);
    lines.push(`  TOTAL: $${cumulative.totalCost.toFixed(4)}`);
  }

  return lines.join("\n");
}