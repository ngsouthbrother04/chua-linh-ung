import fs from "fs/promises";
import path from "path";
import { Queue, Worker, type JobsOptions } from "bullmq";
import prisma from "../lib/prisma";
import { synthesizeWithGoogleCloud } from "./googleTtsClient";

const TTS_QUEUE_NAME = "tts-generation";
const DEFAULT_TTS_LANGUAGES = [
  "vi",
  "en",
  "fr",
  "de",
  "es",
  "pt",
  "ru",
  "zh",
  "id",
  "hi",
  "ar",
  "tr",
] as const;

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 2000,
  },
  removeOnComplete: 100,
  removeOnFail: 200,
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
  mode: "bullmq" | "in-memory";
}

export interface TtsRuntimeConfigValidation {
  ok: boolean;
  queueMode: QueueMode;
  storageProvider: StorageProvider;
  errors: string[];
  warnings: string[];
}

type QueueMode = "bullmq" | "in-memory";
type StorageProvider = "local";

let ttsQueue: Queue | null = null;
let ttsWorker: Worker<TtsJobPayload> | null = null;
const inMemoryInFlightJobs = new Set<string>();

function getQueueMode(): QueueMode {
  return process.env.REDIS_URL ? "bullmq" : "in-memory";
}

function getStorageProvider(): StorageProvider {
  return "local";
}

export function validateTtsRuntimeConfig(): TtsRuntimeConfigValidation {
  const queueMode = getQueueMode();
  const storageProvider = getStorageProvider();
  const errors: string[] = [];
  const warnings: string[] = [];

  if (queueMode === "bullmq" && !process.env.REDIS_URL) {
    errors.push("REDIS_URL is required when queue mode is bullmq.");
  }

  const configuredStorageProvider = (
    process.env.TTS_STORAGE_PROVIDER ?? "local"
  )
    .trim()
    .toLowerCase();
  if (configuredStorageProvider !== "local") {
    errors.push("TTS_STORAGE_PROVIDER must be local.");
  }

  if (storageProvider === "local" && !process.env.TTS_LOCAL_AUDIO_DIR?.trim()) {
    warnings.push(
      "TTS_LOCAL_AUDIO_DIR is not set. Using default public/audio directory.",
    );
  }

  if (!process.env.TTS_SUPPORTED_LANGUAGES?.trim()) {
    warnings.push(
      "TTS_SUPPORTED_LANGUAGES is not set. Falling back to default language list.",
    );
  }

  const requestedProvider = (process.env.TTS_PROVIDER ?? "google")
    .trim()
    .toLowerCase();
  if (requestedProvider && requestedProvider !== "google") {
    warnings.push(
      'TTS_PROVIDER is forced to "google" in current backend implementation.',
    );
  }

  const credentialsJson = process.env.GOOGLE_TTS_CREDENTIALS_JSON?.trim();
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();

  if (!credentialsJson && !credentialsPath) {
    errors.push(
      "Google TTS requires GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_TTS_CREDENTIALS_JSON.",
    );
  }

  const voiceMap = process.env.GOOGLE_TTS_VOICE_MAP?.trim();
  if (voiceMap) {
    try {
      const parsed = JSON.parse(voiceMap) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("GOOGLE_TTS_VOICE_MAP_INVALID_JSON");
      }
    } catch {
      errors.push(
        'GOOGLE_TTS_VOICE_MAP must be valid JSON object (e.g. {"en":"en-US-Standard-C"}).',
      );
    }
  }

  return {
    ok: errors.length === 0,
    queueMode,
    storageProvider,
    errors,
    warnings,
  };
}

function getConfiguredLanguages(): string[] {
  const envValue = process.env.TTS_SUPPORTED_LANGUAGES;
  if (!envValue) {
    return [...DEFAULT_TTS_LANGUAGES];
  }

  const parsed = envValue
    .split(",")
    .map((lang) => lang.trim().toLowerCase())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : [...DEFAULT_TTS_LANGUAGES];
}

function normalizePreviewLanguage(language: string): string {
  const requested = language.trim().toLowerCase();
  const fallback = "vi";
  if (!requested) {
    return fallback;
  }

  const configured = new Set(getConfiguredLanguages());
  if (configured.has(requested)) {
    return requested;
  }

  const base = requested.split("-")[0];
  if (configured.has(base)) {
    return base;
  }

  throw new Error("TTS_LANGUAGE_NOT_SUPPORTED");
}

function detectLanguageFromText(text: string): string {
  const configured = new Set(getConfiguredLanguages());
  const normalized = text.trim();
  const lower = normalized.toLowerCase();

  const fallback = configured.has("vi") ? "vi" : [...configured][0] || "vi";

  if (/[^\x00-\x7F]/.test(normalized) && configured.has("zh")) {
    // Script-based detection below handles non-Latin text first.
  }

  if (/[\u3040-\u30ff\u31f0-\u31ff]/.test(normalized) && configured.has("ja")) {
    return "ja";
  }

  if (
    /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/.test(normalized) &&
    configured.has("ko")
  ) {
    return "ko";
  }

  if (/[\u4e00-\u9fff]/.test(normalized) && configured.has("zh")) {
    return "zh";
  }

  if (/[\u0400-\u04ff]/.test(normalized) && configured.has("ru")) {
    return "ru";
  }

  if (
    /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/.test(normalized) &&
    configured.has("ar")
  ) {
    return "ar";
  }

  if (/[\u0900-\u097f]/.test(normalized) && configured.has("hi")) {
    return "hi";
  }

  if (
    /[ăâđêôơưĂÂĐÊÔƠƯáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/.test(
      normalized,
    ) &&
    configured.has("vi")
  ) {
    return "vi";
  }

  if (/[ğıüşöçİĞÜŞÖÇ]/.test(normalized) && configured.has("tr")) {
    return "tr";
  }

  const tokens = (lower.match(/[a-zA-Z\u00c0-\u024f]+/g) || []).map((token) =>
    token.toLowerCase(),
  );

  const keywordMap: Record<string, string[]> = {
    vi: ["khong", "toi", "ban", "mon", "quan", "pho", "thuc"],
    en: ["the", "and", "is", "are", "with", "for", "this"],
    fr: ["bonjour", "avec", "pour", "une", "les", "des", "est"],
    de: ["und", "ist", "mit", "der", "die", "das", "nicht"],
    es: ["hola", "con", "para", "una", "que", "los", "las"],
    pt: ["ola", "com", "para", "uma", "que", "dos", "das"],
    id: ["dan", "yang", "untuk", "dengan", "ini", "itu", "saya"],
    tr: ["ve", "bir", "icin", "ile", "bu", "su", "degil"],
  };

  let bestLanguage = fallback;
  let bestScore = 0;

  for (const [language, keywords] of Object.entries(keywordMap)) {
    if (!configured.has(language)) {
      continue;
    }

    const score = tokens.reduce(
      (sum, token) => (keywords.includes(token) ? sum + 1 : sum),
      0,
    );

    if (score > bestScore) {
      bestScore = score;
      bestLanguage = language;
    }
  }

  return bestLanguage;
}

function resolvePreviewLanguageFromInput(
  text: string,
  requestedLanguage?: string,
): string {
  const requested = requestedLanguage?.trim().toLowerCase() || "";
  if (!requested || requested === "auto") {
    return detectLanguageFromText(text);
  }

  return normalizePreviewLanguage(requested);
}

function normalizeLocalizedTextMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const result: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (typeof rawValue !== "string") {
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
  return (
    process.env.TTS_LOCAL_AUDIO_DIR ??
    path.resolve(process.cwd(), "public/audio")
  );
}

function getPublicAudioBaseUrl(): string {
  const configured = process.env.TTS_PUBLIC_BASE_URL ?? "/audio";
  return configured.endsWith("/") ? configured.slice(0, -1) : configured;
}

async function saveLocalAudioFile(
  fileName: string,
  content: Buffer,
): Promise<string> {
  const outputDir = getLocalAudioDirectory();
  await fs.mkdir(outputDir, { recursive: true });

  const filePath = path.join(outputDir, fileName);
  await fs.writeFile(filePath, content);

  return `${getPublicAudioBaseUrl()}/${fileName}`;
}

async function saveAudioFile(
  fileName: string,
  content: Buffer,
): Promise<string> {
  return saveLocalAudioFile(fileName, content);
}

async function listLocalAudioFiles(): Promise<string[]> {
  try {
    return await fs.readdir(getLocalAudioDirectory());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

export async function cleanupPoiAudioFiles(
  poiId: string,
  keepFileNames: string[] = [],
): Promise<number> {
  const safePoiId = poiId.trim();
  if (!safePoiId) {
    return 0;
  }

  const keepSet = new Set(
    keepFileNames.map((name) => name.trim()).filter(Boolean),
  );
  const directory = getLocalAudioDirectory();
  const files = await listLocalAudioFiles();
  let removedCount = 0;

  await Promise.all(
    files
      .filter(
        (fileName) =>
          fileName.startsWith(`${safePoiId}_`) && !keepSet.has(fileName),
      )
      .map(async (fileName) => {
        try {
          await fs.rm(path.join(directory, fileName), { force: true });
          removedCount += 1;
        } catch (error) {
          console.warn("[TTS] Failed to cleanup audio file", {
            fileName,
            error,
          });
        }
      }),
  );

  return removedCount;
}

async function cleanupOlderPoiAudioVersions(
  poiId: string,
  language: string,
  keepFileName: string,
): Promise<number> {
  const safePoiId = poiId.trim();
  const safeLanguage = language.trim().toLowerCase();
  if (!safePoiId || !safeLanguage) {
    return 0;
  }

  const directory = getLocalAudioDirectory();
  const files = await listLocalAudioFiles();
  let removedCount = 0;

  await Promise.all(
    files
      .filter(
        (fileName) =>
          fileName.startsWith(`${safePoiId}_${safeLanguage}_v`) &&
          fileName !== keepFileName,
      )
      .map(async (fileName) => {
        try {
          await fs.rm(path.join(directory, fileName), { force: true });
          removedCount += 1;
        } catch (error) {
          console.warn("[TTS] Failed to cleanup stale audio version", {
            fileName,
            error,
          });
        }
      }),
  );

  return removedCount;
}

async function synthesizeText(text: string, language: string): Promise<Buffer> {
  return synthesizeWithGoogleCloud(text, language);
}

export async function synthesizePreviewAudioFromText(
  text: string,
  language = "auto",
): Promise<{
  language: string;
  audioBuffer: Buffer;
}> {
  const normalizedText = text.trim();
  if (!normalizedText) {
    throw new Error("TTS_TEXT_EMPTY");
  }

  if (normalizedText.length > 2000) {
    throw new Error("TTS_TEXT_TOO_LONG");
  }

  const normalizedLanguage = resolvePreviewLanguageFromInput(
    normalizedText,
    language,
  );
  const audioBuffer = await synthesizeText(normalizedText, normalizedLanguage);

  return {
    language: normalizedLanguage,
    audioBuffer,
  };
}

async function processTtsJob(
  payload: TtsJobPayload,
): Promise<{ poiId: string; language: string; audioUrl: string }> {
  const poi = await prisma.pointOfInterest.findUnique({
    where: { id: payload.poiId },
    select: {
      id: true,
      audioUrls: true,
    },
  });

  if (!poi) {
    throw new Error("POI_NOT_FOUND");
  }

  const audioBuffer = await synthesizeText(payload.text, payload.language);
  const fileName = `${payload.poiId}_${payload.language}_v${payload.contentVersion}.wav`;
  const audioUrl = await saveAudioFile(fileName, audioBuffer);
  await cleanupOlderPoiAudioVersions(payload.poiId, payload.language, fileName);

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
    audioUrl,
  };
}

function ensureBullQueue(): Queue {
  if (ttsQueue) {
    return ttsQueue;
  }

  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL_NOT_CONFIGURED");
  }

  const createdQueue = new Queue(TTS_QUEUE_NAME, {
    connection: {
      url: process.env.REDIS_URL,
      maxRetriesPerRequest: null,
    },
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });

  ttsQueue = createdQueue;
  return ttsQueue;
}

export function buildTtsJobId(
  poiId: string,
  language: string,
  contentVersion: number,
): string {
  return `${poiId}:${language}:${contentVersion}`;
}

export function resolveTtsLanguages(
  descriptionMap: Record<string, string>,
): string[] {
  const configured = new Set(getConfiguredLanguages());
  return Object.keys(descriptionMap)
    .map((lang) => lang.toLowerCase())
    .filter((lang) => configured.has(lang));
}

export async function enqueuePoiTtsGeneration(
  poiId: string,
): Promise<EnqueuePoiTtsResult> {
  const poi = await prisma.pointOfInterest.findUnique({
    where: { id: poiId },
    select: {
      id: true,
      description: true,
      contentVersion: true,
    },
  });

  if (!poi) {
    throw new Error("POI_NOT_FOUND");
  }

  const descriptionMap = normalizeLocalizedTextMap(poi.description);
  const languages = resolveTtsLanguages(descriptionMap);
  if (languages.length === 0) {
    throw new Error("TTS_NO_SUPPORTED_LANGUAGE_TEXT");
  }

  const mode = getQueueMode();
  let queued = 0;
  let skipped = 0;
  const jobIds: string[] = [];

  if (mode === "bullmq") {
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
          "generate-poi-audio",
          {
            poiId: poi.id,
            language,
            text: descriptionMap[language],
            contentVersion: poi.contentVersion,
          },
          {
            jobId,
          },
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
        contentVersion: poi.contentVersion,
      })
        .catch((error: unknown) => {
          console.error("[TTS] In-memory job failed", { jobId, error });
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
    mode,
  };
}

export async function initializeTtsWorker(): Promise<void> {
  if (getQueueMode() !== "bullmq") {
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
        maxRetriesPerRequest: null,
      },
      concurrency: Number(process.env.TTS_WORKER_CONCURRENCY ?? 5),
    },
  );

  ttsWorker.on("failed", (job, err) => {
    const jobId = job?.id ?? "unknown";
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
  if (mode === "in-memory") {
    return {
      mode,
      waiting: inMemoryInFlightJobs.size,
      active: inMemoryInFlightJobs.size,
      completed: 0,
      failed: 0,
      delayed: 0,
    };
  }

  const queue = ensureBullQueue();
  const counts = await queue.getJobCounts(
    "waiting",
    "active",
    "completed",
    "failed",
    "delayed",
  );
  return {
    mode,
    waiting: counts.waiting ?? 0,
    active: counts.active ?? 0,
    completed: counts.completed ?? 0,
    failed: counts.failed ?? 0,
    delayed: counts.delayed ?? 0,
  };
}
