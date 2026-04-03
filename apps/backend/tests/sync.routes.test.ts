import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import syncRouter from '../src/routes/api/sync';
import { errorHandlingMiddleware, notFoundMiddleware } from '../src/middlewares/errorHandlingMiddleware';
import { getSyncFull, getSyncManifest } from '../src/services/syncService';
import { isAccessTokenSessionActive, verifyJwt } from '../src/services/authService';

vi.mock('../src/services/syncService', () => ({
  getSyncManifest: vi.fn(),
  getSyncFull: vi.fn()
}));

vi.mock('../src/services/authService', () => ({
  verifyJwt: vi.fn(),
  isAccessTokenSessionActive: vi.fn()
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/sync', syncRouter);
  app.use(notFoundMiddleware);
  app.use(errorHandlingMiddleware);
  return app;
}

describe('SYNC routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyJwt).mockReturnValue({ sub: 'user-id' });
    vi.mocked(isAccessTokenSessionActive).mockResolvedValue(true);
  });

  it('GET /api/v1/sync/manifest should return manifest payload', async () => {
    const app = createApp();

    vi.mocked(getSyncManifest).mockResolvedValue({
      contentVersion: 5,
      totalPois: 10,
      totalTours: 2,
      lastUpdatedAt: new Date().toISOString(),
      checksum: 'sha256-abc'
    });

    const res = await request(app).get('/api/v1/sync/manifest');

    expect(res.status).toBe(200);
    expect(res.body.contentVersion).toBe(5);
  });

  it('GET /api/v1/sync/full should return 401 when missing token', async () => {
    const app = createApp();

    const res = await request(app).get('/api/v1/sync/full');

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('Thiếu hoặc sai định dạng Authorization Bearer token.');
  });

  it('GET /api/v1/sync/full should return 401 on invalid token signature', async () => {
    const app = createApp();
    vi.mocked(verifyJwt).mockImplementation(() => { throw new Error('INVALID_SIGNATURE'); });

    const res = await request(app)
      .get('/api/v1/sync/full')
      .set('Authorization', 'Bearer fake-token-invalid');

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('Token rỗng hoặc không hợp lệ.');
  });

  it('GET /api/v1/sync/full should return 400 for invalid version query', async () => {
    const app = createApp();

    const res = await request(app)
      .get('/api/v1/sync/full?version=abc')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('version phải là số nguyên');
  });

  it('GET /api/v1/sync/full should return full payload when token is valid', async () => {
    const app = createApp();

    vi.mocked(getSyncManifest).mockResolvedValue({
      contentVersion: 6,
      totalPois: 10,
      totalTours: 2,
      lastUpdatedAt: new Date().toISOString(),
      checksum: 'sha256-manifest'
    });

    vi.mocked(getSyncFull).mockResolvedValue({
      contentVersion: 6,
      pois: [
        {
          id: 'poi-1',
          name: { vi: 'A' },
          description: { vi: 'B' },
          audioUrls: { vi: 'url' },
          latitude: 21.0,
          longitude: 105.8,
          type: 'FOOD',
          image: null
        }
      ],
      tours: [
        {
          id: 'tour-1',
          name: { vi: 'T' },
          description: { vi: 'D' },
          duration: 90,
          poiIds: ['poi-1'],
          image: null,
          createdAt: new Date().toISOString()
        }
      ]
    });

    const res = await request(app)
      .get('/api/v1/sync/full?version=1')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.contentVersion).toBe(6);
    expect(res.body.needsSync).toBe(true);
    expect(res.body.pois).toHaveLength(1);
    expect(res.body.tours).toHaveLength(1);
  });

  it('GET /api/v1/sync/full should return empty payload when version is up-to-date', async () => {
    const app = createApp();

    vi.mocked(getSyncManifest).mockResolvedValue({
      contentVersion: 6,
      totalPois: 10,
      totalTours: 2,
      lastUpdatedAt: new Date().toISOString(),
      checksum: 'sha256-manifest'
    });

    const res = await request(app)
      .get('/api/v1/sync/full?version=6')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.contentVersion).toBe(6);
    expect(res.body.needsSync).toBe(false);
    expect(res.body.pois).toEqual([]);
    expect(res.body.tours).toEqual([]);
    expect(getSyncFull).not.toHaveBeenCalled();
  });
});
