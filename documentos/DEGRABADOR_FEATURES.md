# Degrabador - Features, Límites y Cola de Jobs

## Resumen del Servicio
Endpoint: `POST /api/degrabador` — Transcripción + diarización + resumen LLM de audio/video
- **Primary**: AssemblyAI (transcripción + diarización en una llamada)
- **Fallback**: Faster Whisper local (solo transcripción, sin diarización) — *opcional, removible para VPS 2GB*
- **Post-procesamiento**: LLM via OpenRouter (formato Markdown con timestamps + resumen ejecutivo)

---

## Features Implementadas

### 1. Estimación de Costo Previa (`POST /api/degrabador/estimate`)
- Input: `{ durationSeconds: number }`
- Output: costo estimado AssemblyAI + crédito free restante ($50)
- Útil para mostrar al usuario antes de subir archivo

### 2. Upload Async + Job Queue (`POST /api/degrabador`)
- **Respuesta inmediata** (202): `{ jobId, status: "processing" }`
- **Procesamiento en background** (no bloquea request)
- **Cola en memoria**: `Map<string, Job>` — procesa **1 job a la vez** (serializado)
- Persistencia en disco: `uploads/degrabador_results/{jobId}.json`

### 3. Polling de Estado (`GET /api/degrabador/:jobId`)
- Busca en memoria → si no, lee de disco
- Estados: `processing` | `completed` | `error`
- Response incluye: markdown, rawTranscription, costs, error

### 4. Límites de Archivo (Multer)
| Límite | Valor | Config |
|--------|-------|--------|
| Tamaño máx | **25 MB** | `limits: { fileSize: 25 * 1024 * 1024 }` |
| Formatos audio | mp3, wav, ogg, flac, aac, m4a, wma | `ALLOWED_EXTENSIONS` |
| Formatos video | mp4, avi, mov, mkv, webm, flv, wmv | `ALLOWED_EXTENSIONS` |
| Duración máx | **20 min** | `MAX_DURATION_MIN = 20` en service |
| Tamaño máx (service) | **25 MB** | `MAX_FILE_SIZE_MB = 25` |

### 5. Pipeline de Procesamiento
1. **Validación**: tamaño + duración (ffprobe)
2. **Extracción audio**: ffmpeg → FLAC mono 16kHz (`extractAudioFlac`)
3. **Transcripción**: AssemblyAI (speaker labels + timestamps)
4. **Diarización**: incluida en AssemblyAI (speakers A, B, C...)
5. **LLM Formateo**: OpenRouter → Markdown estructurado
   - Resumen ejecutivo
   - Transcripción con timestamps `[MM:SS - MM:SS] Speaker X: "texto"`
6. **Cálculo costos**: desglose AssemblyAI + LLM + acumulado histórico

### 6. Cost Tracking Persistente
- Archivo: `uploads/degrabador_spend.json`
- Acumula: segundos totales, costo AssemblyAI, costo LLM, total, job count
- Crédito free AssemblyAI: $50 (una vez, no mensual)

### 7. Limpieza Automática
- Archivo temporal subido → `fs.unlinkSync` en `finally`
- Directorio temporal `degrabador_temp/` → `rmSync(recursive)` al finalizar

---

## Consideraciones para VPS 1 CPU / 2GB RAM

### Recursos Estimados
| Componente | RAM Pico | CPU | Notas |
|------------|----------|-----|-------|
| Node.js (app) | 200-400 MB | bajo | Base |
| ffmpeg (extracción) | 50-150 MB | **100% 1 CPU** | Serializado por cola |
| AssemblyAI script | ~50 MB | bajo | Solo API call |
| **Total pico** | **~400-550 MB** | **1 CPU** | **Seguro en 2GB** |

### Riesgos Mitigados
✅ **Cola serial** — 1 job a la vez evita picos de RAM/CPU concurrentes  
✅ **Límite 25MB + 20min** — archivos acotados  
✅ **Sin Whisper local** — elimina 1.5GB RAM (modelo `small`)  
✅ **Limpieza temp files** — no acumula basura en disco  

### Riesgos Residuales
⚠️ **CPU bloqueada** durante extracción ffmpeg (10-60s) — requests HTTP otros endpoints pueden lentecerse  
⚠️ **Sin persistencia de cola** — si reinicia PM2, jobs en memoria se pierden (los de disco sobreviven)  
⚠️ **Sin rate limiting** — usuario puede spamear uploads  

---

## Features Sugeridas (Backlog)

| Feature | Prioridad | Esfuerzo |
|---------|-----------|----------|
| Rate limit por IP/cliente (ej. 5 uploads/hora) | Alta | Bajo |
| Cola persistente (BullMQ + Redis) | Media | Medio |
| Webhook/callback al completar job | Media | Bajo |
| Cancelar job en progreso | Baja | Medio |
| Soporte chunked upload (>25MB) | Baja | Alto |
| Métricas Prometheus (jobs, duration, costs) | Baja | Medio |
| Auto-limpieza jobs antiguos (>7 días) | Media | Bajo |

---

## Configuración Requerida (`.env`)
```env
ASSEMBLYAI_API_KEY=xxx           # Obligatorio (primary)
OPENROUTER_API_KEY=xxx           # Obligatorio (LLM formatting)
OPENROUTER_MODEL=nvidia/nemotron-3-super-120b-a12b:free
PYTHON_BIN=/root/ovni_agent/scripts/venv2/bin/python  # Linux path
# PYTHON_BIN_VENV2=... (igual que PYTHON_BIN en Linux)
```

---

## Deploy Checklist Específico Degrabador
- [ ] `apt install ffmpeg` en VPS
- [ ] Python 3.10+ + `venv2` con `assemblyai` + `python-dotenv`
- [ ] `ASSEMBLYAI_API_KEY` en `.env` production
- [ ] `OPENROUTER_API_KEY` en `.env` production
- [ ] Directorio `uploads/degrabador_results` writable por PM2 user
- [ ] Verificar `PYTHON_BIN` apunta a venv2 Linux (no `.exe`)
- [ ] Test: `curl -F "file=@test.mp3" https://api.ovnistudio.com.ar/api/degrabador`