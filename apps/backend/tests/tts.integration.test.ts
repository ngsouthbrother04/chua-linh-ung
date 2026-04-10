import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import prisma from "../src/lib/prisma";
import { enqueuePoiTtsGeneration } from "../src/services/ttsService";

vi.mock("../src/services/googleTtsClient", () => ({
  synthesizeWithGoogleCloud: vi.fn(async (text: string) =>
    Buffer.from(`RIFF:${text}`),
  ),
}));

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const describeIfDb = hasDatabaseUrl ? describe : describe.skip;

const TEST_POI_ID = "poi-tts-integration-001";
let tempAudioDir = "";

async function waitForAudioUrls(
  poiId: string,
  timeoutMs = 3000,
): Promise<Record<string, string>> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const poi = await prisma.pointOfInterest.findUnique({
      where: { id: poiId },
      select: { audioUrls: true },
    });

    const audioUrls = (poi?.audioUrls ?? {}) as Record<string, string>;
    if (audioUrls.vi && audioUrls.en) {
      return audioUrls;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error("Timed out waiting for TTS audio_urls update");
}

describeIfDb("TTS integration with real Prisma", () => {
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    tempAudioDir = await fs.mkdtemp(
      path.join(process.cwd(), ".tmp-tts-audio-"),
    );

    process.env.TTS_STORAGE_PROVIDER = "local";
    process.env.TTS_LOCAL_AUDIO_DIR = tempAudioDir;
    process.env.TTS_PUBLIC_BASE_URL = "/audio-test";
    process.env.TTS_SUPPORTED_LANGUAGES = "vi,en";
    process.env.TTS_PROVIDER = "google";
    process.env.GOOGLE_TTS_CREDENTIALS_JSON = JSON.stringify({
      client_email: "test@example.com",
      private_key: "test-key",
    });
    delete process.env.REDIS_URL;

    await prisma.pointOfInterest.upsert({
      where: { id: TEST_POI_ID },
      update: {
        name: { vi: "POI TTS Test", en: "POI TTS Test" },
        description: {
          vi: "Noi dung tieng Viet de tao audio",
          en: "English content to generate audio",
        },
        audioUrls: {},
        latitude: "21.028500",
        longitude: "105.854200",
        type: "FOOD",
        image: "https://cdn.phoamthuc.local/poi/test.jpg",
        contentVersion: 99,
      },
      create: {
        id: TEST_POI_ID,
        name: { vi: "POI TTS Test", en: "POI TTS Test" },
        description: {
          vi: "Noi dung tieng Viet de tao audio",
          en: "English content to generate audio",
        },
        audioUrls: {},
        latitude: "21.028500",
        longitude: "105.854200",
        type: "FOOD",
        image: "https://cdn.phoamthuc.local/poi/test.jpg",
        contentVersion: 99,
      },
    });
  });

  afterEach(async () => {
    if (tempAudioDir) {
      await fs.rm(tempAudioDir, { recursive: true, force: true });
      tempAudioDir = "";
    }
  });

  afterAll(async () => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value !== undefined) {
        process.env[key] = value;
      }
    }

    await prisma.$disconnect();
  });

  it("enqueuePoiTtsGeneration should asynchronously update audio_urls for configured languages", async () => {
    const result = await enqueuePoiTtsGeneration(TEST_POI_ID);

    expect(result.mode).toBe("in-memory");
    expect(result.queued).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.jobIds).toContain("poi-tts-integration-001:vi:99");
    expect(result.jobIds).toContain("poi-tts-integration-001:en:99");

    const audioUrls = await waitForAudioUrls(TEST_POI_ID);
    expect(audioUrls.vi).toContain(
      "/audio-test/poi-tts-integration-001_vi_v99.wav",
    );
    expect(audioUrls.en).toContain(
      "/audio-test/poi-tts-integration-001_en_v99.wav",
    );

    const viFilePath = path.join(
      tempAudioDir,
      "poi-tts-integration-001_vi_v99.wav",
    );
    const enFilePath = path.join(
      tempAudioDir,
      "poi-tts-integration-001_en_v99.wav",
    );
    const [viStat, enStat] = await Promise.all([
      fs.stat(viFilePath),
      fs.stat(enFilePath),
    ]);

    expect(viStat.isFile()).toBe(true);
    expect(enStat.isFile()).toBe(true);
  });
});
