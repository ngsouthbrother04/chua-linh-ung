import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import adminRouter from '../src/routes/api/admin';
import { errorHandlingMiddleware, notFoundMiddleware } from '../src/middlewares/errorHandlingMiddleware';

vi.mock('../src/services/ttsService', () => ({
  enqueuePoiTtsGeneration: vi.fn(),
  getTtsQueueStatus: vi.fn(),
  validateTtsRuntimeConfig: vi.fn()
}));

vi.mock('../src/services/imageService', () => ({
  uploadPoiImage: vi.fn(),
  uploadTourImage: vi.fn()
}));

vi.mock('../src/services/poiAdminService', () => ({
  createAdminPoi: vi.fn(),
  createAdminTour: vi.fn(),
  deleteAdminPoi: vi.fn(),
  deleteAdminTour: vi.fn(),
  getAdminPoiById: vi.fn(),
  getAdminTourById: vi.fn(),
  invalidateSyncManifest: vi.fn(),
  listAdminPois: vi.fn(),
  purgeSoftDeletedPois: vi.fn(),
  publishAdminPoi: vi.fn(),
  updateAdminPoi: vi.fn(),
  updateAdminTour: vi.fn()
}));

import { enqueuePoiTtsGeneration, getTtsQueueStatus, validateTtsRuntimeConfig } from '../src/services/ttsService';
import { uploadPoiImage, uploadTourImage } from '../src/services/imageService';
import {
  createAdminPoi,
  createAdminTour,
  deleteAdminPoi,
  deleteAdminTour,
  getAdminPoiById,
  getAdminTourById,
  invalidateSyncManifest,
  listAdminPois,
  purgeSoftDeletedPois,
  publishAdminPoi,
  updateAdminPoi,
  updateAdminTour
} from '../src/services/poiAdminService';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin', adminRouter);
  app.use(notFoundMiddleware);
  app.use(errorHandlingMiddleware);
  return app;
}

describe('ADMIN routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ADMIN_API_KEY;
  });

  it('POST /api/v1/admin/pois/:id/audio/generate should enqueue tts jobs', async () => {
    const app = createApp();

    vi.mocked(enqueuePoiTtsGeneration).mockResolvedValue({
      poiId: 'poi-1',
      queued: 3,
      skipped: 0,
      jobIds: ['poi-1:vi:1', 'poi-1:en:1', 'poi-1:ja:1'],
      mode: 'in-memory'
    });

    const res = await request(app).post('/api/v1/admin/pois/poi-1/audio/generate').send({});

    expect(res.status).toBe(202);
    expect(res.body.poiId).toBe('poi-1');
    expect(res.body.queued).toBe(3);
    expect(enqueuePoiTtsGeneration).toHaveBeenCalledWith('poi-1');
  });

  it('POST /api/v1/admin/pois/:id/audio/generate should return 403 with wrong admin token', async () => {
    process.env.ADMIN_API_KEY = 'secret-admin';
    const app = createApp();

    const res = await request(app)
      .post('/api/v1/admin/pois/poi-1/audio/generate')
      .set('x-admin-api-key', 'wrong-token')
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('Không có quyền');
    expect(enqueuePoiTtsGeneration).not.toHaveBeenCalled();
  });

  it('GET /api/v1/admin/tts/queue/status should return queue stats', async () => {
    const app = createApp();

    vi.mocked(getTtsQueueStatus).mockResolvedValue({
      mode: 'in-memory',
      waiting: 2,
      active: 2,
      completed: 0,
      failed: 0,
      delayed: 0
    });

    const res = await request(app).get('/api/v1/admin/tts/queue/status');

    expect(res.status).toBe(200);
    expect(res.body.waiting).toBe(2);
    expect(getTtsQueueStatus).toHaveBeenCalledTimes(1);
  });

  it('GET /api/v1/admin/tts/config/validate should return 200 when runtime config is valid', async () => {
    const app = createApp();

    vi.mocked(validateTtsRuntimeConfig).mockReturnValue({
      ok: true,
      queueMode: 'in-memory',
      storageProvider: 'local',
      errors: [],
      warnings: []
    });

    const res = await request(app).get('/api/v1/admin/tts/config/validate');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('GET /api/v1/admin/tts/config/validate should return 500 when runtime config is invalid', async () => {
    const app = createApp();

    vi.mocked(validateTtsRuntimeConfig).mockReturnValue({
      ok: false,
      queueMode: 'bullmq',
      storageProvider: 'local',
      errors: ['TTS_STORAGE_PROVIDER must be local.'],
      warnings: []
    });

    const res = await request(app).get('/api/v1/admin/tts/config/validate');

    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
    expect(res.body.errors).toHaveLength(1);
  });

  it('POST /api/v1/admin/pois/:id/image/upload should upload image and return cloudinary url', async () => {
    const app = createApp();

    vi.mocked(uploadPoiImage).mockResolvedValue({
      poiId: 'poi-1',
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/phoamthuc/pois/poi-1.jpg',
      contentVersion: 4
    });

    const res = await request(app)
      .post('/api/v1/admin/pois/poi-1/image/upload')
      .attach('image', Buffer.from('fake-image-binary'), {
        filename: 'poi-1.jpg',
        contentType: 'image/jpeg'
      });

    expect(res.status).toBe(200);
    expect(res.body.poiId).toBe('poi-1');
    expect(res.body.imageUrl).toContain('cloudinary.com');
    expect(res.body.contentVersion).toBe(4);
    expect(uploadPoiImage).toHaveBeenCalledTimes(1);
  });

  it('POST /api/v1/admin/pois/:id/image/upload should return 400 when missing image file', async () => {
    const app = createApp();

    const res = await request(app).post('/api/v1/admin/pois/poi-1/image/upload').send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Thiếu file ảnh');
    expect(uploadPoiImage).not.toHaveBeenCalled();
  });

  it('POST /api/v1/admin/pois/:id/image/upload should return 403 with wrong admin token', async () => {
    process.env.ADMIN_API_KEY = 'secret-admin';
    const app = createApp();

    const res = await request(app)
      .post('/api/v1/admin/pois/poi-1/image/upload')
      .set('x-admin-api-key', 'wrong-token')
      .attach('image', Buffer.from('fake-image-binary'), {
        filename: 'poi-1.jpg',
        contentType: 'image/jpeg'
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('Không có quyền');
    expect(uploadPoiImage).not.toHaveBeenCalled();
  });

  it('POST /api/v1/admin/tours/:id/image/upload should upload image and return cloudinary url', async () => {
    const app = createApp();

    vi.mocked(uploadTourImage).mockResolvedValue({
      tourId: 'tour-1',
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/phoamthuc/tours/tour-1.jpg',
      contentVersion: 7
    });

    const res = await request(app)
      .post('/api/v1/admin/tours/tour-1/image/upload')
      .attach('image', Buffer.from('fake-image-binary'), {
        filename: 'tour-1.jpg',
        contentType: 'image/jpeg'
      });

    expect(res.status).toBe(200);
    expect(res.body.tourId).toBe('tour-1');
    expect(res.body.imageUrl).toContain('cloudinary.com');
    expect(res.body.contentVersion).toBe(7);
    expect(uploadTourImage).toHaveBeenCalledTimes(1);
  });

  it('POST /api/v1/admin/pois should create a POI', async () => {
    const app = createApp();

    vi.mocked(createAdminPoi).mockResolvedValue({
      id: 'poi-1',
      name: { vi: 'Phở Thìn' },
      description: { vi: 'Nổi tiếng' },
      audioUrls: {},
      latitude: 21.01,
      longitude: 105.85,
      type: 'FOOD',
      image: null,
      isPublished: false,
      publishedAt: null,
      deletedAt: null,
      contentVersion: 1,
      createdAt: new Date('2026-03-25T00:00:00Z').toISOString(),
      updatedAt: new Date('2026-03-25T00:00:00Z').toISOString()
    } as never);

    const res = await request(app).post('/api/v1/admin/pois').send({
      name: { vi: 'Phở Thìn' },
      description: { vi: 'Nổi tiếng' },
      latitude: 21.01,
      longitude: 105.85,
      type: 'FOOD'
    });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('poi-1');
    expect(createAdminPoi).toHaveBeenCalledTimes(1);
  });

  it('POST /api/v1/admin/pois/:id/publish should publish a POI and queue TTS', async () => {
    const app = createApp();

    vi.mocked(publishAdminPoi).mockResolvedValue({
      id: 'poi-1',
      name: { vi: 'Phở Thìn' },
      description: { vi: 'Nổi tiếng' },
      audioUrls: {},
      latitude: 21.01,
      longitude: 105.85,
      type: 'FOOD',
      image: null,
      isPublished: true,
      publishedAt: new Date('2026-03-26T00:00:00Z').toISOString(),
      deletedAt: null,
      contentVersion: 2,
      createdAt: new Date('2026-03-25T00:00:00Z').toISOString(),
      updatedAt: new Date('2026-03-26T00:00:00Z').toISOString(),
      syncVersion: 12
    } as never);
    vi.mocked(enqueuePoiTtsGeneration).mockResolvedValue({
      poiId: 'poi-1',
      queued: 2,
      skipped: 0,
      jobIds: ['poi-1:vi:2', 'poi-1:en:2'],
      mode: 'in-memory'
    });

    const res = await request(app).post('/api/v1/admin/pois/poi-1/publish').send({});

    expect(res.status).toBe(200);
    expect(res.body.isPublished).toBe(true);
    expect(res.body.syncVersion).toBe(12);
    expect(res.body.ttsQueued).toBe(2);
    expect(publishAdminPoi).toHaveBeenCalledWith(
      'poi-1',
      expect.objectContaining({
        source: 'api'
      })
    );
    expect(enqueuePoiTtsGeneration).toHaveBeenCalledWith('poi-1');
  });

  it('GET /api/v1/admin/pois should list POIs', async () => {
    const app = createApp();

    vi.mocked(listAdminPois).mockResolvedValue([
      {
        id: 'poi-1',
        name: { vi: 'Phở Thìn' },
        description: { vi: 'Nổi tiếng' },
        audioUrls: {},
        latitude: 21.01,
        longitude: 105.85,
        type: 'FOOD',
        image: null,
        isPublished: false,
        publishedAt: null,
        deletedAt: null,
        contentVersion: 1,
        createdAt: new Date('2026-03-25T00:00:00Z').toISOString(),
        updatedAt: new Date('2026-03-25T00:00:00Z').toISOString()
      } as never
    ]);

    const res = await request(app).get('/api/v1/admin/pois');

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(listAdminPois).toHaveBeenCalledTimes(1);
  });

  it('GET /api/v1/admin/pois/:id should return a POI', async () => {
    const app = createApp();

    vi.mocked(getAdminPoiById).mockResolvedValue({
      id: 'poi-1',
      name: { vi: 'Phở Thìn' },
      description: { vi: 'Nổi tiếng' },
      audioUrls: {},
      latitude: 21.01,
      longitude: 105.85,
      type: 'FOOD',
      image: null,
      isPublished: false,
      publishedAt: null,
      deletedAt: null,
      contentVersion: 1,
      createdAt: new Date('2026-03-25T00:00:00Z').toISOString(),
      updatedAt: new Date('2026-03-25T00:00:00Z').toISOString()
    } as never);

    const res = await request(app).get('/api/v1/admin/pois/poi-1');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('poi-1');
    expect(getAdminPoiById).toHaveBeenCalledWith('poi-1');
  });

  it('PUT /api/v1/admin/pois/:id should update a POI', async () => {
    const app = createApp();

    vi.mocked(updateAdminPoi).mockResolvedValue({
      id: 'poi-1',
      name: { vi: 'Phở Thìn mới' },
      description: { vi: 'Cập nhật' },
      audioUrls: {},
      latitude: 21.02,
      longitude: 105.86,
      type: 'FOOD',
      image: null,
      isPublished: false,
      publishedAt: null,
      deletedAt: null,
      contentVersion: 2,
      createdAt: new Date('2026-03-25T00:00:00Z').toISOString(),
      updatedAt: new Date('2026-03-26T00:00:00Z').toISOString()
    } as never);

    const res = await request(app)
      .put('/api/v1/admin/pois/poi-1')
      .send({ name: { vi: 'Phở Thìn mới' } });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('poi-1');
    expect(updateAdminPoi).toHaveBeenCalledWith(
      'poi-1',
      { name: { vi: 'Phở Thìn mới' } },
      expect.objectContaining({
        source: 'api'
      })
    );
  });

  it('DELETE /api/v1/admin/pois/:id should soft delete a POI', async () => {
    const app = createApp();

    vi.mocked(deleteAdminPoi).mockResolvedValue({
      id: 'poi-1',
      name: { vi: 'Phở Thìn' },
      description: { vi: 'Nổi tiếng' },
      audioUrls: {},
      latitude: 21.01,
      longitude: 105.85,
      type: 'FOOD',
      image: null,
      isPublished: false,
      publishedAt: null,
      deletedAt: new Date('2026-03-26T00:00:00Z').toISOString(),
      contentVersion: 2,
      createdAt: new Date('2026-03-25T00:00:00Z').toISOString(),
      updatedAt: new Date('2026-03-26T00:00:00Z').toISOString()
    } as never);

    const res = await request(app).delete('/api/v1/admin/pois/poi-1');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('poi-1');
    expect(deleteAdminPoi).toHaveBeenCalledWith(
      'poi-1',
      expect.objectContaining({
        source: 'api'
      })
    );
  });

  it('POST /api/v1/admin/tours should create a Tour', async () => {
    const app = createApp();

    vi.mocked(createAdminTour).mockResolvedValue({
      id: 'tour-1',
      name: { vi: 'Tour Pho Co' },
      description: { vi: 'Kham pha pho co' },
      duration: 90,
      poiIds: ['poi-1', 'poi-2'],
      image: null,
      isPublished: true,
      publishedAt: new Date('2026-03-26T00:00:00Z').toISOString(),
      deletedAt: null,
      contentVersion: 1,
      createdAt: new Date('2026-03-26T00:00:00Z').toISOString(),
      updatedAt: new Date('2026-03-26T00:00:00Z').toISOString()
    } as never);

    const res = await request(app)
      .post('/api/v1/admin/tours')
      .send({
        name: { vi: 'Tour Pho Co' },
        description: { vi: 'Kham pha pho co' },
        poiIds: ['poi-1', 'poi-2'],
        duration: 90
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('tour-1');
    expect(createAdminTour).toHaveBeenCalledTimes(1);
  });

  it('GET /api/v1/admin/tours/:id should return a Tour', async () => {
    const app = createApp();

    vi.mocked(getAdminTourById).mockResolvedValue({
      id: 'tour-1',
      name: { vi: 'Tour Pho Co' },
      description: { vi: 'Kham pha pho co' },
      duration: 90,
      poiIds: ['poi-1', 'poi-2'],
      image: null,
      isPublished: true,
      publishedAt: new Date('2026-03-26T00:00:00Z').toISOString(),
      deletedAt: null,
      contentVersion: 1,
      createdAt: new Date('2026-03-26T00:00:00Z').toISOString(),
      updatedAt: new Date('2026-03-26T00:00:00Z').toISOString()
    } as never);

    const res = await request(app).get('/api/v1/admin/tours/tour-1');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('tour-1');
    expect(getAdminTourById).toHaveBeenCalledWith('tour-1');
  });

  it('PUT /api/v1/admin/tours/:id should update a Tour', async () => {
    const app = createApp();

    vi.mocked(updateAdminTour).mockResolvedValue({
      id: 'tour-1',
      name: { vi: 'Tour Pho Co Moi' },
      description: { vi: 'Cap nhat' },
      duration: 95,
      poiIds: ['poi-1', 'poi-3'],
      image: null,
      isPublished: true,
      publishedAt: new Date('2026-03-27T00:00:00Z').toISOString(),
      deletedAt: null,
      contentVersion: 2,
      createdAt: new Date('2026-03-26T00:00:00Z').toISOString(),
      updatedAt: new Date('2026-03-27T00:00:00Z').toISOString()
    } as never);

    const res = await request(app)
      .put('/api/v1/admin/tours/tour-1')
      .send({ name: { vi: 'Tour Pho Co Moi' }, duration: 95 });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('tour-1');
    expect(updateAdminTour).toHaveBeenCalledWith(
      'tour-1',
      { name: { vi: 'Tour Pho Co Moi' }, duration: 95 },
      expect.objectContaining({
        source: 'api'
      })
    );
  });

  it('DELETE /api/v1/admin/tours/:id should soft delete a Tour', async () => {
    const app = createApp();

    vi.mocked(deleteAdminTour).mockResolvedValue({
      id: 'tour-1',
      name: { vi: 'Tour Pho Co' },
      description: { vi: 'Kham pha pho co' },
      duration: 90,
      poiIds: ['poi-1', 'poi-2'],
      image: null,
      isPublished: false,
      publishedAt: null,
      deletedAt: new Date('2026-03-27T00:00:00Z').toISOString(),
      contentVersion: 3,
      createdAt: new Date('2026-03-26T00:00:00Z').toISOString(),
      updatedAt: new Date('2026-03-27T00:00:00Z').toISOString()
    } as never);

    const res = await request(app).delete('/api/v1/admin/tours/tour-1');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('tour-1');
    expect(deleteAdminTour).toHaveBeenCalledWith(
      'tour-1',
      expect.objectContaining({
        source: 'api'
      })
    );
  });

  it('POST /api/v1/admin/sync/invalidate should bump sync version', async () => {
    const app = createApp();

    vi.mocked(invalidateSyncManifest).mockResolvedValue({
      invalidated: true,
      syncVersion: 99
    });

    const res = await request(app).post('/api/v1/admin/sync/invalidate').send({});

    expect(res.status).toBe(200);
    expect(res.body.invalidated).toBe(true);
    expect(res.body.syncVersion).toBe(99);
    expect(invalidateSyncManifest).toHaveBeenCalledTimes(1);
  });

  it('POST /api/v1/admin/maintenance/pois/soft-delete-cleanup should run retention cleanup', async () => {
    const app = createApp();

    vi.mocked(purgeSoftDeletedPois).mockResolvedValue({
      dryRun: false,
      retentionDays: 90,
      cutoffAt: '2026-01-01T00:00:00.000Z',
      scanned: 2,
      purged: 2,
      deletedIds: ['poi-1', 'poi-2'],
      audioFilesRemoved: 4,
      imagesRemoved: 1,
      imageCleanupFailed: 0
    });

    const res = await request(app)
      .post('/api/v1/admin/maintenance/pois/soft-delete-cleanup')
      .send({ dryRun: false, reason: 'manual maintenance' });

    expect(res.status).toBe(200);
    expect(res.body.purged).toBe(2);
    expect(purgeSoftDeletedPois).toHaveBeenCalledWith(
      expect.objectContaining({
        dryRun: false,
        context: expect.objectContaining({
          source: 'api'
        })
      })
    );
  });
});
