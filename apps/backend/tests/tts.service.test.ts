import { describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { buildTtsJobId, resolveTtsLanguages, validateTtsRuntimeConfig } from '../src/services/ttsService';
import { cleanupPoiAudioFiles } from '../src/services/ttsService';

describe('ttsService helpers', () => {
  it('buildTtsJobId should include poiId, language and content version', () => {
    expect(buildTtsJobId('poi-123', 'vi', 7)).toBe('poi-123:vi:7');
  });

  it('resolveTtsLanguages should only return supported languages', () => {
    const languages = resolveTtsLanguages({
      vi: 'Noi dung tieng Viet',
      en: 'English content',
      xx: 'Unsupported language content'
    });

    expect(languages).toEqual(['vi', 'en']);
  });

  it('validateTtsRuntimeConfig should return errors when storage provider is not local', () => {
    const originalEnv = { ...process.env };
    process.env.TTS_STORAGE_PROVIDER = 's3';

    const validation = validateTtsRuntimeConfig();

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain('TTS_STORAGE_PROVIDER must be local.');

    process.env = originalEnv;
  });

  it('validateTtsRuntimeConfig should pass for local storage', () => {
    const originalEnv = { ...process.env };
    process.env.TTS_STORAGE_PROVIDER = 'local';

    const validation = validateTtsRuntimeConfig();

    expect(validation.ok).toBe(true);
    expect(validation.errors).toHaveLength(0);

    process.env = originalEnv;
  });

  it('cleanupPoiAudioFiles should remove stale POI audio files', async () => {
    const originalEnv = { ...process.env };
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'poi-audio-cleanup-'));

    process.env.TTS_LOCAL_AUDIO_DIR = tempDir;

    await fs.writeFile(path.join(tempDir, 'poi-1_vi_v1.wav'), 'a');
    await fs.writeFile(path.join(tempDir, 'poi-1_en_v1.wav'), 'b');
    await fs.writeFile(path.join(tempDir, 'poi-2_vi_v1.wav'), 'c');

    const removed = await cleanupPoiAudioFiles('poi-1');

    expect(removed).toBe(2);
    await expect(fs.stat(path.join(tempDir, 'poi-1_vi_v1.wav'))).rejects.toThrow();
    await expect(fs.stat(path.join(tempDir, 'poi-1_en_v1.wav'))).rejects.toThrow();
    await expect(fs.stat(path.join(tempDir, 'poi-2_vi_v1.wav'))).resolves.toBeTruthy();

    await fs.rm(tempDir, { recursive: true, force: true });
    process.env = originalEnv;
  });
});
