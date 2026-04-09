import 'dotenv/config';
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

describeIfDb('ADMIN tour CRUD integration', () => {
  const app = createApp();
  const poiIds = [`tour-poi-1-${Date.now()}`, `tour-poi-2-${Date.now()}`];
  const originalEnv = { ...process.env };
  const { token: adminToken } = createAuthToken('integration-admin', undefined, 'ADMIN');
  let createdTourId: string | null = null;
  let originalAppSettingState: {
    currentVersion: number;
    dataChecksum: string | null;
    mediaBasePath: string;
    deltaWindowVersions: number;
    features: unknown;
  } | null = null;

  beforeAll(async () => {
    await prisma.$connect();

    originalAppSettingState = await prisma.appSetting.findUnique({
      where: { id: 1 },
      select: {
        currentVersion: true,
        dataChecksum: true,
        mediaBasePath: true,
        deltaWindowVersions: true,
        features: true
      }
    });

    await prisma.user.upsert({
      where: { id: 'integration-admin' },
      update: { role: 'ADMIN', email: 'admin@integration.test' },
      create: {
        id: 'integration-admin',
        email: 'admin@integration.test',
        passwordHash: 'dummy',
        fullName: 'Integration Admin',
        role: 'ADMIN'
      }
    });
  });

  beforeEach(async () => {
    await prisma.appSetting.upsert({
      where: { id: 1 },
      update: {
        currentVersion: 1,
        dataChecksum: null,
        mediaBasePath: '/audio/',
        deltaWindowVersions: 5,
        features: {}
      },
      create: {
        id: 1,
        currentVersion: 1,
        dataChecksum: null,
        mediaBasePath: '/audio/',
        deltaWindowVersions: 5,
        features: {}
      }
    });

    await prisma.pointOfInterest.deleteMany({
      where: {
        id: {
          in: poiIds
        }
      }
    });

    const existingTours = await prisma.tour.findMany({
      select: {
        id: true,
        poiIds: true
      }
    });

    const matchingTourIds = existingTours
      .filter((tour) => Array.isArray(tour.poiIds) && tour.poiIds.some((poiId) => poiIds.includes(poiId as string)))
      .map((tour) => tour.id);

    if (matchingTourIds.length > 0) {
      await prisma.tour.deleteMany({
        where: {
          id: {
            in: matchingTourIds
          }
        }
      });
    }

    await prisma.pointOfInterest.createMany({
      data: poiIds.map((poiId, index) => ({
        id: poiId,
        name: { vi: `POI ${index + 1}` },
        description: { vi: `Description ${index + 1}` },
        audioUrls: {},
        latitude: 21.0 + index * 0.001,
        longitude: 105.8 + index * 0.001,
        type: 'FOOD',
        image: null,
        isPublished: true,
        publishedAt: new Date('2026-03-25T00:00:00.000Z')
      }))
    });
  });

  afterAll(async () => {
    if (createdTourId) {
      await prisma.tour.deleteMany({
        where: { id: createdTourId }
      });
    }

    await prisma.pointOfInterest.deleteMany({
      where: {
        id: {
          in: poiIds
        }
      }
    });

    if (originalAppSettingState) {
      await prisma.appSetting.upsert({
        where: { id: 1 },
        update: {
          currentVersion: originalAppSettingState.currentVersion,
          dataChecksum: originalAppSettingState.dataChecksum,
          mediaBasePath: originalAppSettingState.mediaBasePath,
          deltaWindowVersions: originalAppSettingState.deltaWindowVersions,
          features: originalAppSettingState.features as never
        },
        create: {
          id: 1,
          currentVersion: originalAppSettingState.currentVersion,
          dataChecksum: originalAppSettingState.dataChecksum ?? undefined,
          mediaBasePath: originalAppSettingState.mediaBasePath,
          deltaWindowVersions: originalAppSettingState.deltaWindowVersions,
          features: originalAppSettingState.features as never
        }
      });
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

    await prisma.user.deleteMany({
      where: { id: 'integration-admin' }
    });

    await prisma.$disconnect();
  });

  it('should create, read, update, and soft delete a tour in the DB', async () => {
    const createResponse = await request(app)
      .post('/api/v1/admin/tours')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-admin-actor', 'integration-test')
      .send({
        name: { vi: 'Tour Pho Co', en: 'Old Quarter Tour' },
        description: { vi: 'Khám phá phố cổ', en: 'Explore the old quarter' },
        poiIds,
        duration: 120
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.poiIds).toEqual(poiIds);
    createdTourId = createResponse.body.id;

    const createdTour = await prisma.tour.findUnique({
      where: { id: createResponse.body.id }
    });

    expect(createdTour).toBeTruthy();
    expect(createdTour?.isPublished).toBe(true);
    expect(createdTour?.deletedAt).toBeNull();
    expect(createdTour?.contentVersion).toBe(1);
    expect(createdTour?.poiIds).toEqual(poiIds);

    const getResponse = await request(app)
      .get(`/api/v1/admin/tours/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.id).toBe(createResponse.body.id);
    expect(getResponse.body.poiIds).toEqual(poiIds);

    const updateResponse = await request(app)
      .put(`/api/v1/admin/tours/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-admin-actor', 'integration-test')
      .send({
        name: { vi: 'Tour Pho Co Moi', en: 'Updated Old Quarter Tour' },
        description: { vi: 'Cập nhật lộ trình', en: 'Updated route' },
        poiIds: [poiIds[1], poiIds[0]],
        duration: 135
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.contentVersion).toBe(2);
    expect(updateResponse.body.duration).toBe(135);
    expect(updateResponse.body.poiIds).toEqual([poiIds[1], poiIds[0]]);

    const updatedTour = await prisma.tour.findUnique({
      where: { id: createResponse.body.id }
    });

    expect(updatedTour).toBeTruthy();
    expect(updatedTour?.contentVersion).toBe(2);
    expect(updatedTour?.duration).toBe(135);
    expect(updatedTour?.poiIds).toEqual([poiIds[1], poiIds[0]]);
    expect(updatedTour?.isPublished).toBe(true);

    const deleteResponse = await request(app)
      .delete(`/api/v1/admin/tours/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-admin-actor', 'integration-test');

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.deletedAt).toBeTruthy();

    const deletedTour = await prisma.tour.findUnique({
      where: { id: createResponse.body.id }
    });

    expect(deletedTour).toBeTruthy();
    expect(deletedTour?.deletedAt).not.toBeNull();
    expect(deletedTour?.isPublished).toBe(false);
    expect(deletedTour?.contentVersion).toBe(3);
  });
});
