import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import analyticsRouter from '../src/routes/api/analytics';
import { errorHandlingMiddleware, notFoundMiddleware } from '../src/middlewares/errorHandlingMiddleware';
import { processBatchEvents, processPresenceHeartbeat, getAnalyticsStats } from '../src/services/analyticsService';
import { isAccessTokenSessionActive, verifyJwt, isUserPremium } from '../src/services/authService';

vi.mock('../src/services/analyticsService', () => ({
  processBatchEvents: vi.fn(),
  processPresenceHeartbeat: vi.fn(),
  getAnalyticsStats: vi.fn()
}));

vi.mock('../src/services/authService', () => ({
  verifyJwt: vi.fn(),
  isAccessTokenSessionActive: vi.fn(),
  isUserPremium: vi.fn()
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/analytics', analyticsRouter);
  app.use(notFoundMiddleware);
  app.use(errorHandlingMiddleware);
  return app;
}

describe('Analytics API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyJwt).mockReturnValue({ sub: 'user-id' });
    vi.mocked(isAccessTokenSessionActive).mockResolvedValue(true);
    vi.mocked(isUserPremium).mockResolvedValue(false);
  });

  it('POST /api/v1/analytics/events should process batch events', async () => {
    const app = createApp();
    vi.mocked(processBatchEvents).mockResolvedValue(2);

    const res = await request(app)
      .post('/api/v1/analytics/events')
      .send({
        events: [
          { deviceId: 'dev1', sessionId: 'ses1', action: 'PLAY', timestamp: 123 },
          { deviceId: 'dev1', sessionId: 'ses1', action: 'STOP', timestamp: 124 }
        ]
      })
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.processedCount).toBe(2);
    expect(res.body.failedCount).toBe(0);
  });

  it('POST /api/v1/analytics/presence/heartbeat should update presence (TC-18.8)', async () => {
    const app = createApp();
    vi.mocked(processPresenceHeartbeat).mockResolvedValue({
      onlineNowWindowSec: 90,
      active5mWindowSec: 300
    });

    const res = await request(app)
      .post('/api/v1/analytics/presence/heartbeat')
      .send({
        deviceId: 'devXYZ',
        sessionId: 'sesABC',
        appState: 'foreground',
        audioState: 'playing',
        timestamp: Date.now()
      })
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.onlineNowWindowSec).toBe(90);
  });

  it('GET /api/v1/analytics/stats should return stats mapping', async () => {
    vi.mocked(verifyJwt).mockReturnValue({ sub: 'user-id', role: 'ADMIN' });
    const app = createApp();
    vi.mocked(getAnalyticsStats).mockResolvedValue({
      plays: 10,
      qrScans: 5,
      topPois: []
    });

    const res = await request(app)
      .get('/api/v1/analytics/stats')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.data.plays).toBe(10);
  });
});
