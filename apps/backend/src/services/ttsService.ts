import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { spawn } from 'node:child_process';
import { Queue, Worker, type JobsOptions } from 'bullmq';
import prisma from '../lib/prisma';

const TTS_QUEUE_NAME = 'tts-generation';
const DEFAULT_TTS_LANGUAGES = [
  'vi',
  'en',
  'fr',
  'de',
  'es',
  'pt',
  'ru',
  'zh',
  'id',
  'hi',
  'ar',
  'tr'
] as const;

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000
  },
  removeOnComplete: 100,
  removeOnFail: 200
};

export interface TtsJobPayload {
  poiId: string;
  language: string;
  text: string;
  contentVersion: number;
}

export interface EnqueuePoiTtsResult {
  poiId: string;
  queued: number;
  skipped: number;
  jobIds: string[];
  mode: 'bullmq' | 'in-memory';
}

export interface TtsRuntimeConfigValidation {
  ok: boolean;
  queueMode: QueueMode;
  storageProvider: StorageProvider;
  errors: string[];
  warnings: string[];
}

type QueueMode = 'bullmq' | 'in-memory';
type StorageProvider = 'local';

let ttsQueue: Queue | null = null;
let ttsWorker: Worker<TtsJobPayload> | null = null;
const inMemoryInFlightJobs = new Set<string>();

function getQueueMode(): QueueMode {
  return process.env.REDIS_URL ? 'bullmq' : 'in-memory';
}

function getStorageProvider(): StorageProvider {
  return 'local';
}

function getPiperBinary(): string {
  return process.env.PIPER_BIN?.trim() || 'piper';
}

function parsePiperModelMap(): Record<string, string> {
  const raw = process.env.PIPER_MODEL_MAP?.trim();
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('PIPER_MODEL_MAP must be a JSON object.');
    }

    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value !== 'string') {
        continue;
      }

      const k = key.trim().toLowerCase();
      const v = value.trim();
      if (!k || !v) {
        continue;
      }

      normalized[k] = v;
    }

    return normalized;
  } catch {
    throw new Error('PIPER_MODEL_MAP_INVALID_JSON');
  }
}

function resolvePiperModelPath(language: string): string {
  const normalizedLanguage = language.trim().toLowerCase();
  const languageBase = normalizedLanguage.split('-')[0];

  const modelMap = parsePiperModelMap();
  const fromMap = modelMap[normalizedLanguage] ?? modelMap[languageBase];
  if (fromMap) {
    return path.resolve(fromMap);
  }

  const modelDir = process.env.PIPER_MODEL_DIR?.trim();
  if (modelDir) {
    return path.resolve(modelDir, `${languageBase}.onnx`);
  }

  throw new Error('PIPER_MODEL_NOT_CONFIGURED');
}

export function validateTtsRuntimeConfig(): TtsRuntimeConfigValidation {
  const queueMode = getQueueMode();
  const storageProvider = getStorageProvider();
  const errors: string[] = [];
  const warnings: string[] = [];

  if (queueMode === 'bullmq' && !process.env.REDIS_URL) {
    errors.push('REDIS_URL is required when queue mode is bullmq.');
  }

  const configuredStorageProvider = (process.env.TTS_STORAGE_PROVIDER ?? 'local').trim().toLowerCase();
  if (configuredStorageProvider !== 'local') {
    errors.push('TTS_STORAGE_PROVIDER must be local.');
  }

  if (storageProvider === 'local' && !process.env.TTS_LOCAL_AUDIO_DIR?.trim()) {
    warnings.push('TTS_LOCAL_AUDIO_DIR is not set. Using default public/audio directory.');
  }

  if (!process.env.TTS_SUPPORTED_LANGUAGES?.trim()) {
    warnings.push('TTS_SUPPORTED_LANGUAGES is not set. Falling back to default language list.');
  }

  const piperModelDir = process.env.PIPER_MODEL_DIR?.trim();
  const piperModelMap = process.env.PIPER_MODEL_MAP?.trim();
  if (!piperModelDir && !piperModelMap) {
    warnings.push('PIPER_MODEL_DIR or PIPER_MODEL_MAP is not set. TTS generation may fail at runtime.');
  }

  if (piperModelMap) {
    try {
      parsePiperModelMap();
    } catch {
      errors.push('PIPER_MODEL_MAP must be valid JSON object (e.g. {"vi":"./models/vi.onnx"}).');
    }
  }

  return {
    ok: errors.length === 0,
    queueMode,
    storageProvider,
    errors,
    warnings
  };
}

function getConfiguredLanguages(): string[] {
  const envValue = process.env.TTS_SUPPORTED_LANGUAGES;
  if (!envValue) {
    return [...DEFAULT_TTS_LANGUAGES];
  }

  const parsed = envValue
    .split(',')
    .map((lang) => lang.trim().toLowerCase())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : [...DEFAULT_TTS_LANGUAGES];
}

function normalizeLocalizedTextMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const result: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
    if (typeof rawValue !== 'string') {
      continue;
    }

    const normalized = rawValue.trim();
    if (!normalized) {
      continue;
    }

    result[key.toLowerCase()] = normalized;
  }

  return result;
}

function getLocalAudioDirectory(): string {
  return process.env.TTS_LOCAL_AUDIO_DIR ?? path.resolve(process.cwd(), 'public/audio');
}

function getPublicAudioBaseUrl(): string {
  const configured = process.env.TTS_PUBLIC_BASE_URL ?? '/audio';
  return configured.endsWith('/') ? configured.slice(0, -1) : configured;
}

async function saveLocalAudioFile(fileName: string, content: Buffer): Promise<string> {
  const outputDir = getLocalAudioDirectory();
  await fs.mkdir(outputDir, { recursive: true });

  const filePath = path.join(outputDir, fileName);
  await fs.writeFile(filePath, content);

  return `${getPublicAudioBaseUrl()}/${fileName}`;
}

async function saveAudioFile(fileName: string, content: Buffer): Promise<string> {
  return saveLocalAudioFile(fileName, content);
}

async function synthesizeWithPiper(text: string, language: string): Promise<Buffer> {
  const modelPath = resolvePiperModelPath(language);
  await fs.access(modelPath);

  const outputPath = path.join(
    os.tmpdir(),
    `piper-${Date.now()}-${Math.random().toString(16).slice(2)}-${language}.wav`
  );

  const piperBin = getPiperBinary();
  const args = ['--model', modelPath, '--output_file', outputPath];

  const stderrChunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    const child = spawn(piperBin, args, {
      stdio: ['pipe', 'ignore', 'pipe']
    });

    child.on('error', (error) => {
      reject(new Error(`PIPER_EXECUTION_FAILED: ${String(error)}`));
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      const stderr = Buffer.concat(stderrChunks).toString('utf8').trim();
      reject(new Error(`PIPER_PROCESS_EXIT_${code}${stderr ? `: ${stderr}` : ''}`));
    });

    child.stdin.write(text);
    child.stdin.write('\n');
    child.stdin.end();
  });

  try {
    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(outputPath, { force: true });
  }
}

async function processTtsJob(payload: TtsJobPayload): Promise<{ poiId: string; language: string; audioUrl: string }> {
  const poi = await prisma.pointOfInterest.findUnique({
    where: { id: payload.poiId },
    select: {
      id: true,
      audioUrls: true
    }
  });

  if (!poi) {
    throw new Error('POI_NOT_FOUND');
  }

  const audioBuffer = await synthesizeWithPiper(payload.text, payload.language);
  const fileName = `${payload.poiId}_${payload.language}_v${payload.contentVersion}.wav`;
  const audioUrl = await saveAudioFile(fileName, audioBuffer);

  await prisma.$executeRaw`
    UPDATE points_of_interest
    SET audio_urls = jsonb_set(
      COALESCE(audio_urls::jsonb, '{}'::jsonb),
      ARRAY[${payload.language}]::text[],
      to_jsonb(${audioUrl}::text),
      true
    )
    WHERE id = ${payload.poiId}
  `;

  return {
    poiId: payload.poiId,
    language: payload.language,
    audioUrl
  };
}

function ensureBullQueue(): Queue {
  if (ttsQueue) {
    return ttsQueue;
  }

  if (!process.env.REDIS_URL) {
    throw new Error('REDIS_URL_NOT_CONFIGURED');
  }

  const createdQueue = new Queue(TTS_QUEUE_NAME, {
    connection: {
      url: process.env.REDIS_URL,
      maxRetriesPerRequest: null
    },
    defaultJobOptions: DEFAULT_JOB_OPTIONS
  });

  ttsQueue = createdQueue;
  return ttsQueue;
}

export function buildTtsJobId(poiId: string, language: string, contentVersion: number): string {
  return `${poiId}:${language}:${contentVersion}`;
}

export function resolveTtsLanguages(descriptionMap: Record<string, string>): string[] {
  const configured = new Set(getConfiguredLanguages());
  return Object.keys(descriptionMap)
    .map((lang) => lang.toLowerCase())
    .filter((lang) => configured.has(lang));
}

export async function enqueuePoiTtsGeneration(poiId: string): Promise<EnqueuePoiTtsResult> {
  const poi = await prisma.pointOfInterest.findUnique({
    where: { id: poiId },
    select: {
      id: true,
      description: true,
      contentVersion: true
    }
  });

  if (!poi) {
    throw new Error('POI_NOT_FOUND');
  }

  const descriptionMap = normalizeLocalizedTextMap(poi.description);
  const languages = resolveTtsLanguages(descriptionMap);
  if (languages.length === 0) {
    throw new Error('TTS_NO_SUPPORTED_LANGUAGE_TEXT');
  }

  const mode = getQueueMode();
  let queued = 0;
  let skipped = 0;
  const jobIds: string[] = [];

  if (mode === 'bullmq') {
    const queue = ensureBullQueue();
    for (const language of languages) {
      const jobId = buildTtsJobId(poi.id, language, poi.contentVersion);
      jobIds.push(jobId);

      const existingJob = await queue.getJob(jobId);
      if (existingJob) {
        skipped += 1;
        continue;
      }

      try {
        await queue.add(
          'generate-poi-audio',
          {
            poiId: poi.id,
            language,
            text: descriptionMap[language],
            contentVersion: poi.contentVersion
          },
          {
            jobId
          }
        );
        queued += 1;
      } catch (error) {
        throw error;
      }
    }
  } else {
    for (const language of languages) {
      const jobId = buildTtsJobId(poi.id, language, poi.contentVersion);
      jobIds.push(jobId);

      if (inMemoryInFlightJobs.has(jobId)) {
        skipped += 1;
        continue;
      }

      inMemoryInFlightJobs.add(jobId);
      queued += 1;

      void processTtsJob({
        poiId: poi.id,
        language,
        text: descriptionMap[language],
        contentVersion: poi.contentVersion
      })
        .catch((error: unknown) => {
          console.error('[TTS] In-memory job failed', { jobId, error });
        })
        .finally(() => {
          inMemoryInFlightJobs.delete(jobId);
        });
    }
  }

  return {
    poiId,
    queued,
    skipped,
    jobIds,
    mode
  };
}

export async function initializeTtsWorker(): Promise<void> {
  if (getQueueMode() !== 'bullmq') {
    return;
  }

  if (ttsWorker) {
    return;
  }

  const queue = ensureBullQueue();

  ttsWorker = new Worker<TtsJobPayload>(
    TTS_QUEUE_NAME,
    async (job) => {
      await processTtsJob(job.data);
    },
    {
      connection: {
        url: process.env.REDIS_URL,
        maxRetriesPerRequest: null
      },
      concurrency: Number(process.env.TTS_WORKER_CONCURRENCY ?? 5)
    }
  );

  ttsWorker.on('failed', (job, err) => {
    const jobId = job?.id ?? 'unknown';
    console.error(`[TTS] Job failed: ${jobId}`, err);
  });

  await queue.waitUntilReady();
  await ttsWorker.waitUntilReady();
}

export async function getTtsQueueStatus(): Promise<{
  mode: QueueMode;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const mode = getQueueMode();
  if (mode === 'in-memory') {
    return {
      mode,
      waiting: inMemoryInFlightJobs.size,
      active: inMemoryInFlightJobs.size,
      completed: 0,
      failed: 0,
      delayed: 0
    };
  }

  const queue = ensureBullQueue();
  const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
  return {
    mode,
    waiting: counts.waiting ?? 0,
    active: counts.active ?? 0,
    completed: counts.completed ?? 0,
    failed: counts.failed ?? 0,
    delayed: counts.delayed ?? 0
  };
}
