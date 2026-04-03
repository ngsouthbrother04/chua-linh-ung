import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prisma from '../src/lib/prisma';
import syncRouter from '../src/routes/api/sync';
import { errorHandlingMiddleware, notFoundMiddleware } from '../src/middlewares/errorHandlingMiddleware';
import { buildSeedDataset } from '../src/services/seedService';
import { createAuthToken, verifyJwt } from '../src/services/authService';

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const describeIfDb = hasDatabaseUrl ? describe : describe.skip;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/sync', syncRouter);
  app.use(notFoundMiddleware);
  app.use(errorHandlingMiddleware);
  return app;
}

async function seedActiveSession(token: string, deviceId: string): Promise<{ sessionId: string }> {
  const payload = verifyJwt(token);
  const sessionId = crypto.randomUUID();

  await prisma.authSession.create({
    data: {
      id: sessionId,
      deviceId,
      refreshTokenHash: crypto.createHash('sha256').update(`${token}:${deviceId}`).digest('hex'),
      accessTokenJti: typeof payload.jti === 'string' ? payload.jti : null,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    }
  });

  return { sessionId };
}

describeIfDb('SYNC integration with real Prisma', () => {
  const contentVersion = 1001;
  const dataset = buildSeedDataset(contentVersion, 1_700_000_000_000);

  beforeAll(async () => {
    await prisma.$connect();

    for (const poi of dataset.pois) {
      await prisma.pointOfInterest.upsert({
        where: { id: poi.id },
        update: {
          name: poi.name,
          description: poi.description,
          audioUrls: poi.audioUrls,
          latitude: poi.latitude,
          longitude: poi.longitude,
          type: poi.type,
          image: poi.image,
          isPublished: true,
          publishedAt: new Date('2026-03-25T00:00:00Z'),
          contentVersion: poi.contentVersion
        },
        create: {
          id: poi.id,
          name: poi.name,
          description: poi.description,
          audioUrls: poi.audioUrls,
          latitude: poi.latitude,
          longitude: poi.longitude,
          type: poi.type,
          image: poi.image,
          isPublished: true,
          publishedAt: new Date('2026-03-25T00:00:00Z'),
          contentVersion: poi.contentVersion
        }
      });
    }

    for (const tour of dataset.tours) {
      await prisma.tour.upsert({
        where: { id: tour.id },
        update: {
          name: tour.name,
          description: tour.description,
          duration: tour.duration,
          poiIds: tour.poiIds,
          image: tour.image,
          isPublished: true,
          publishedAt: new Date('2026-03-25T00:00:00Z'),
          contentVersion: tour.contentVersion
        },
        create: {
          id: tour.id,
          name: tour.name,
          description: tour.description,
          duration: tour.duration,
          poiIds: tour.poiIds,
          image: tour.image,
          isPublished: true,
          publishedAt: new Date('2026-03-25T00:00:00Z'),
          contentVersion: tour.contentVersion
        }
      });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('GET /api/v1/sync/manifest should reflect seeded runtime data', async () => {
    const app = createApp();

    const res = await request(app).get('/api/v1/sync/manifest');

    expect(res.status).toBe(200);
    expect(res.body.contentVersion).toBeGreaterThanOrEqual(contentVersion);
    expect(res.body.totalPois).toBeGreaterThanOrEqual(dataset.pois.length);
    expect(res.body.totalTours).toBeGreaterThanOrEqual(dataset.tours.length);
    expect(typeof res.body.lastUpdatedAt).toBe('string');
    expect(res.body.checksum).toMatch(/^sha256-[a-f0-9]{64}$/);
  });

  it('GET /api/v1/sync/full should include seeded POIs and Tours with correct values', async () => {
    const app = createApp();

    const { token } = createAuthToken('integration-test');
    const deviceId = `sync-integration-${Date.now()}`;
    const { sessionId } = await seedActiveSession(token, deviceId);

    try {
      const res = await request(app)
        .get('/api/v1/sync/full?version=0')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.contentVersion).toBeGreaterThanOrEqual(contentVersion);

      const poiById = new Map<string, any>(res.body.pois.map((poi: any) => [poi.id, poi]));
      const tourById = new Map<string, any>(res.body.tours.map((tour: any) => [tour.id, tour]));

      for (const seededPoi of dataset.pois) {
        const poi = poiById.get(seededPoi.id);
        expect(poi).toBeDefined();
        expect(poi.name).toEqual(seededPoi.name);
        expect(poi.description).toEqual(seededPoi.description);
        expect(poi.audioUrls).toEqual(seededPoi.audioUrls);
        expect(poi.type).toBe(seededPoi.type);
        expect(poi.image).toBe(seededPoi.image);
        expect(poi.latitude).toBeCloseTo(Number(seededPoi.latitude), 6);
        expect(poi.longitude).toBeCloseTo(Number(seededPoi.longitude), 6);
      }

      for (const seededTour of dataset.tours) {
        const tour = tourById.get(seededTour.id);
        expect(tour).toBeDefined();
        expect(tour.name).toEqual(seededTour.name);
        expect(tour.description).toEqual(seededTour.description);
        expect(tour.duration).toBe(seededTour.duration);
        expect(tour.image).toBe(seededTour.image);
        expect(tour.poiIds).toEqual(seededTour.poiIds);
        expect(typeof tour.createdAt).toBe('string');
      }
    } finally {
      await prisma.authSession.deleteMany({ where: { id: sessionId } });
    }
  });

  it('GET /api/v1/sync/full should short-circuit when client version is current', async () => {
    const app = createApp();

    const manifestRes = await request(app).get('/api/v1/sync/manifest');
    expect(manifestRes.status).toBe(200);

    const currentVersion = manifestRes.body.contentVersion;
    const { token } = createAuthToken('integration-test');
    const deviceId = `sync-integration-${Date.now()}-current`;
    const { sessionId } = await seedActiveSession(token, deviceId);

    try {
      const fullRes = await request(app)
        .get(`/api/v1/sync/full?version=${currentVersion}`)
        .set('Authorization', `Bearer ${token}`);

      expect(fullRes.status).toBe(200);
      expect(fullRes.body.contentVersion).toBe(currentVersion);
      expect(fullRes.body.needsSync).toBe(false);
      expect(fullRes.body.pois).toEqual([]);
      expect(fullRes.body.tours).toEqual([]);
    } finally {
      await prisma.authSession.deleteMany({ where: { id: sessionId } });
    }
  });
});
