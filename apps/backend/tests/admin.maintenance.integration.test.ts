import 'dotenv/config';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import prisma from '../src/lib/prisma';
import adminRouter from '../src/routes/api/admin';
import { createAuthToken } from '../src/services/authService';
import { errorHandlingMiddleware, notFoundMiddleware } from '../src/middlewares/errorHandlingMiddleware';

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const describeIfDb = hasDatabaseUrl ? describe : describe.skip;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin', adminRouter);
  app.use(notFoundMiddleware);
  app.use(errorHandlingMiddleware);
  return app;
}

describeIfDb('ADMIN maintenance integration', () => {
  const app = createApp();
  const oldPoiId = `poi-maint-old-${Date.now()}`;
  const recentPoiId = `poi-maint-recent-${Date.now()}`;
  const { token: adminToken } = createAuthToken('integration-admin', undefined, 'ADMIN');
  let tempAudioDir = '';
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    tempAudioDir = await fs.mkdtemp(path.join(os.tmpdir(), 'poi-maint-cleanup-'));

    process.env.POI_SOFT_DELETE_RETENTION_DAYS = '30';
    process.env.TTS_LOCAL_AUDIO_DIR = tempAudioDir;

    await prisma.pointOfInterest.deleteMany({
      where: {
        id: {
          in: [oldPoiId, recentPoiId]
        }
      }
    });

    await prisma.pointOfInterest.create({
      data: {
        id: oldPoiId,
        name: { vi: 'Old POI' },
        description: { vi: 'Old POI for retention cleanup' },
        audioUrls: { vi: `/audio/${oldPoiId}_vi_v1.wav` },
        latitude: '21.028500',
        longitude: '105.854200',
        type: 'FOOD',
        image: null,
        isPublished: false,
        deletedAt: new Date('2025-01-01T00:00:00.000Z')
      }
    });

    await prisma.pointOfInterest.create({
      data: {
        id: recentPoiId,
        name: { vi: 'Recent POI' },
        description: { vi: 'Recent POI should not be purged' },
        audioUrls: { vi: `/audio/${recentPoiId}_vi_v1.wav` },
        latitude: '21.028600',
        longitude: '105.854300',
        type: 'FOOD',
        image: null,
        isPublished: false,
        deletedAt: new Date('2026-03-31T00:00:00.000Z')
      }
    });

    await fs.writeFile(path.join(tempAudioDir, `${oldPoiId}_vi_v1.wav`), 'old-audio');
    await fs.writeFile(path.join(tempAudioDir, `${recentPoiId}_vi_v1.wav`), 'recent-audio');
  });

  afterAll(async () => {
    await prisma.pointOfInterest.deleteMany({
      where: {
        id: {
          in: [oldPoiId, recentPoiId]
        }
      }
    });

    if (tempAudioDir) {
      await fs.rm(tempAudioDir, { recursive: true, force: true });
    }

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

  it('should return dry-run summary without deleting records', async () => {
    const response = await request(app)
      .post('/api/v1/admin/maintenance/pois/soft-delete-cleanup')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-admin-actor', 'integration-test')
      .send({ dryRun: true, reason: 'verify dry-run' });

    expect(response.status).toBe(200);
    expect(response.body.dryRun).toBe(true);
    expect(response.body.scanned).toBe(1);
    expect(response.body.purged).toBe(0);

    const oldPoi = await prisma.pointOfInterest.findUnique({ where: { id: oldPoiId } });
    expect(oldPoi).toBeTruthy();
  });

  it('should purge only POIs older than retention and cleanup old audio files', async () => {
    const response = await request(app)
      .post('/api/v1/admin/maintenance/pois/soft-delete-cleanup')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-admin-actor', 'integration-test')
      .send({ dryRun: false, reason: 'execute retention cleanup' });

    expect(response.status).toBe(200);
    expect(response.body.dryRun).toBe(false);
    expect(response.body.purged).toBe(1);
    expect(response.body.deletedIds).toContain(oldPoiId);
    expect(response.body.deletedIds).not.toContain(recentPoiId);

    const oldPoi = await prisma.pointOfInterest.findUnique({ where: { id: oldPoiId } });
    const recentPoi = await prisma.pointOfInterest.findUnique({ where: { id: recentPoiId } });

    expect(oldPoi).toBeNull();
    expect(recentPoi).toBeTruthy();

    await expect(fs.stat(path.join(tempAudioDir, `${oldPoiId}_vi_v1.wav`))).rejects.toThrow();
    await expect(fs.stat(path.join(tempAudioDir, `${recentPoiId}_vi_v1.wav`))).resolves.toBeTruthy();
  });
});
