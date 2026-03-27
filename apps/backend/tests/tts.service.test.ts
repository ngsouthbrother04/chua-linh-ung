import { describe, expect, it } from 'vitest';
import { buildTtsJobId, resolveTtsLanguages, validateTtsRuntimeConfig } from '../src/services/ttsService';

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
});
