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

import { enqueuePoiTtsGeneration, getTtsQueueStatus, validateTtsRuntimeConfig } from '../src/services/ttsService';
import { uploadPoiImage, uploadTourImage } from '../src/services/imageService';

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
});
