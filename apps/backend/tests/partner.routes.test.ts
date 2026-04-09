import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import partnerRouter from '../src/routes/api/partner';
import { errorHandlingMiddleware, notFoundMiddleware } from '../src/middlewares/errorHandlingMiddleware';
import ApiError from '../src/utils/ApiError';

vi.mock('../src/services/imageService', () => ({
  uploadPoiImage: vi.fn(),
  uploadTourImage: vi.fn()
}));

vi.mock('../src/services/partnerApprovalService', () => ({
  createPartnerApprovalRequest: vi.fn(),
  listApprovalRequestsByRequester: vi.fn(),
  getApprovalRequestByIdForRequester: vi.fn()
}));

vi.mock('../src/services/poiAdminService', () => ({
  getAdminPoiById: vi.fn(),
  getAdminTourById: vi.fn()
}));

vi.mock('../src/services/authService', () => ({
  verifyJwt: vi.fn(),
  isAccessTokenSessionActive: vi.fn(),
  getCurrentUserRole: vi.fn()
}));

import { uploadPoiImage, uploadTourImage } from '../src/services/imageService';
import {
  createPartnerApprovalRequest,
  listApprovalRequestsByRequester,
  getApprovalRequestByIdForRequester
} from '../src/services/partnerApprovalService';
import { getAdminPoiById, getAdminTourById } from '../src/services/poiAdminService';
import { getCurrentUserRole, isAccessTokenSessionActive, verifyJwt } from '../src/services/authService';

const PARTNER_AUTH_HEADER = 'Bearer partner-token';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/partner', partnerRouter);
  app.use(notFoundMiddleware);
  app.use(errorHandlingMiddleware);
  return app;
}

describe('PARTNER routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyJwt).mockReturnValue({ sub: 'partner-1', role: 'PARTNER' });
    vi.mocked(isAccessTokenSessionActive).mockResolvedValue(true);
    vi.mocked(getCurrentUserRole).mockResolvedValue('PARTNER');
    vi.mocked(getAdminPoiById).mockResolvedValue({ id: 'poi-1' } as never);
    vi.mocked(getAdminTourById).mockResolvedValue({ id: 'tour-1' } as never);
  });

  it('POST /api/v1/partner/pois should submit create request', async () => {
    const app = createApp();
    vi.mocked(createPartnerApprovalRequest).mockResolvedValue({
      id: 'req-1',
      entityType: 'POI',
      actionType: 'CREATE',
      targetId: null,
      payload: { name: { vi: 'Phở Thìn' } },
      status: 'PENDING',
      reason: 'new poi',
      decisionNote: null,
      requestedBy: 'partner-1',
      reviewedBy: null,
      resultSnapshot: null,
      reviewedAt: null,
      createdAt: new Date('2026-03-26T00:00:00Z').toISOString(),
      updatedAt: new Date('2026-03-26T00:00:00Z').toISOString()
    } as never);

    const res = await request(app)
      .post('/api/v1/partner/pois')
      .set('Authorization', PARTNER_AUTH_HEADER)
      .send({
        name: { vi: 'Phở Thìn' },
        description: { vi: 'Nổi tiếng' },
        latitude: 21.01,
        longitude: 105.85,
        type: 'FOOD',
        radius: 50
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('req-1');
    expect(createPartnerApprovalRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        requestedBy: 'partner-1',
        entityType: 'POI',
        actionType: 'CREATE'
      })
    );
  });

  it('POST /api/v1/partner/pois/:id/image/upload should upload POI image', async () => {
    const app = createApp();
    vi.mocked(uploadPoiImage).mockResolvedValue({
      poiId: 'poi-1',
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/phoamthuc/pois/poi-1.jpg',
      contentVersion: 3
    });

    const res = await request(app)
      .post('/api/v1/partner/pois/poi-1/image/upload')
      .set('Authorization', PARTNER_AUTH_HEADER)
      .attach('image', Buffer.from('fake-image-binary'), {
        filename: 'poi-1.jpg',
        contentType: 'image/jpeg'
      });

    expect(res.status).toBe(200);
    expect(res.body.poiId).toBe('poi-1');
    expect(uploadPoiImage).toHaveBeenCalledWith('poi-1', expect.any(Object));
    expect(getAdminPoiById).toHaveBeenCalledWith('poi-1', { actorId: 'partner-1', role: 'PARTNER' });
  });

  it('POST /api/v1/partner/tours/:id/image/upload should upload tour image', async () => {
    const app = createApp();
    vi.mocked(uploadTourImage).mockResolvedValue({
      tourId: 'tour-1',
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/phoamthuc/tours/tour-1.jpg',
      contentVersion: 4
    });

    const res = await request(app)
      .post('/api/v1/partner/tours/tour-1/image/upload')
      .set('Authorization', PARTNER_AUTH_HEADER)
      .attach('image', Buffer.from('fake-image-binary'), {
        filename: 'tour-1.jpg',
        contentType: 'image/jpeg'
      });

    expect(res.status).toBe(200);
    expect(res.body.tourId).toBe('tour-1');
    expect(uploadTourImage).toHaveBeenCalledWith('tour-1', expect.any(Object));
    expect(getAdminTourById).toHaveBeenCalledWith('tour-1', { actorId: 'partner-1', role: 'PARTNER' });
  });

  it('POST /api/v1/partner/pois/:id/image/upload should reject when PARTNER does not own the POI', async () => {
    const app = createApp();
    vi.mocked(getAdminPoiById).mockRejectedValue(new ApiError(403, 'Không có quyền truy cập POI này.'));

    const res = await request(app)
      .post('/api/v1/partner/pois/poi-foreign/image/upload')
      .set('Authorization', PARTNER_AUTH_HEADER)
      .attach('image', Buffer.from('fake-image-binary'), {
        filename: 'poi-foreign.jpg',
        contentType: 'image/jpeg'
      });

    expect(res.status).toBe(403);
    expect(uploadPoiImage).not.toHaveBeenCalled();
    expect(getAdminPoiById).toHaveBeenCalledWith('poi-foreign', { actorId: 'partner-1', role: 'PARTNER' });
  });

  it('POST /api/v1/partner/tours/:id/image/upload should reject when PARTNER does not own the Tour', async () => {
    const app = createApp();
    vi.mocked(getAdminTourById).mockRejectedValue(new ApiError(403, 'Không có quyền truy cập Tour này.'));

    const res = await request(app)
      .post('/api/v1/partner/tours/tour-foreign/image/upload')
      .set('Authorization', PARTNER_AUTH_HEADER)
      .attach('image', Buffer.from('fake-image-binary'), {
        filename: 'tour-foreign.jpg',
        contentType: 'image/jpeg'
      });

    expect(res.status).toBe(403);
    expect(uploadTourImage).not.toHaveBeenCalled();
    expect(getAdminTourById).toHaveBeenCalledWith('tour-foreign', { actorId: 'partner-1', role: 'PARTNER' });
  });

  it('GET /api/v1/partner/approval-requests/mine should list my requests', async () => {
    const app = createApp();
    vi.mocked(listApprovalRequestsByRequester).mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/partner/approval-requests/mine?status=PENDING')
      .set('Authorization', PARTNER_AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });

  it('GET /api/v1/partner/approval-requests/mine/:id should return 404 when owner mismatch', async () => {
    const app = createApp();
    vi.mocked(getApprovalRequestByIdForRequester).mockRejectedValue(new ApiError(404, 'Không tìm thấy approval request.'));

    const res = await request(app)
      .get('/api/v1/partner/approval-requests/mine/req-other')
      .set('Authorization', PARTNER_AUTH_HEADER);

    expect(res.status).toBe(404);
  });
});
