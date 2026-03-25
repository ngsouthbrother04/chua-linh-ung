import { describe, expect, it } from 'vitest';
import { buildSeedDataset } from '../src/services/seedService';

describe('seedService', () => {
  it('buildSeedDataset should create 10 POIs and 3 tours', () => {
    const dataset = buildSeedDataset(3, 1_700_000_000_000);

    expect(dataset.pois).toHaveLength(10);
    expect(dataset.tours).toHaveLength(3);
    expect(dataset.analyticsEvents.length).toBeGreaterThanOrEqual(5);
  });

  it('all POIs should contain multilingual fields for 6 supported languages', () => {
    const dataset = buildSeedDataset();
    const langs = ['vi', 'en', 'ko', 'zh', 'ja', 'th'];

    for (const poi of dataset.pois) {
      for (const lang of langs) {
        expect(poi.name[lang]).toBeTypeOf('string');
        expect(poi.description[lang]).toBeTypeOf('string');
        expect(poi.audioUrls[lang]).toContain(`/audio/${lang}/`);
      }
    }
  });

  it('tour poiIds should reference existing POIs only', () => {
    const dataset = buildSeedDataset();
    const poiIds = new Set(dataset.pois.map((poi) => poi.id));

    for (const tour of dataset.tours) {
      for (const poiId of tour.poiIds) {
        expect(poiIds.has(poiId)).toBe(true);
      }
    }
  });

  it('all POI coordinates should be numeric and in valid range', () => {
    const dataset = buildSeedDataset();

    for (const poi of dataset.pois) {
      const lat = Number.parseFloat(poi.latitude);
      const lon = Number.parseFloat(poi.longitude);
      expect(Number.isFinite(lat)).toBe(true);
      expect(Number.isFinite(lon)).toBe(true);
      expect(lat).toBeGreaterThanOrEqual(-90);
      expect(lat).toBeLessThanOrEqual(90);
      expect(lon).toBeGreaterThanOrEqual(-180);
      expect(lon).toBeLessThanOrEqual(180);
    }
  });

  it('should produce deterministic analytics timestamps with fixed nowMs', () => {
    const dataset = buildSeedDataset(1, 1_700_000_000_000);
    const timestamps = dataset.analyticsEvents.map((event) => event.timestamp);

    expect(timestamps).toEqual([
      1_700_000_000_000n,
      1_700_000_018_000n,
      1_700_000_042_000n,
      1_700_000_055_000n,
      1_700_000_070_000n,
    ]);
  });
});
