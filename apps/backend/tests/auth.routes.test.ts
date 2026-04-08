import crypto from 'crypto';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import authRouter from '../src/routes/api/auth';
import { errorHandlingMiddleware, notFoundMiddleware } from '../src/middlewares/errorHandlingMiddleware';
import {
  registerUser,
  loginUser,
  redeemClaimCode,
  finalizePayment,
  initiatePayment,
  refreshAuthSession,
  revokeAuthSessionByAccessToken,
  isAccessTokenSessionActive,
  verifyJwt
} from '../src/services/authService';
import { verifyVNPaySignature, verifyMoMoSignature } from '../src/utils/paymentVerifier';
import { requireAuth } from '../src/middlewares/authMiddleware';

vi.mock('../src/services/authService', () => ({
  registerUser: vi.fn(),
  loginUser: vi.fn(),
  redeemClaimCode: vi.fn(),
  initiatePayment: vi.fn(),
  finalizePayment: vi.fn(),
  refreshAuthSession: vi.fn(),
  revokeAuthSessionByAccessToken: vi.fn(),
  isAccessTokenSessionActive: vi.fn(),
  verifyJwt: vi.fn()
}));

vi.mock('../src/utils/paymentVerifier', () => ({
  verifyVNPaySignature: vi.fn(),
  verifyMoMoSignature: vi.fn()
}));


function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRouter);
  app.get('/protected', requireAuth, (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.use(notFoundMiddleware);
  app.use(errorHandlingMiddleware);
  return app;
}

describe('AUTH routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PAYMENT_CALLBACK_SECRET = 'unit-test-secret';
    process.env.PAYMENT_CALLBACK_MAX_AGE_SECONDS = '300';
    vi.mocked(verifyJwt).mockReturnValue({ sub: 'user-1', jti: 'jti-1' });
    vi.mocked(isAccessTokenSessionActive).mockResolvedValue(true);
  });

  it('POST /api/v1/auth/token-refresh should return new token payload', async () => {
    const app = createApp();
    vi.mocked(refreshAuthSession).mockResolvedValue({
      token: 'token-refresh-1',
      accessToken: 'token-refresh-1',
      tokenType: 'Bearer',
      expiresIn: 86400,
      role: 'USER',
      refreshToken: 'refresh-1',
      refreshExpiresIn: 2592000,
      deviceId: 'd1',
      sessionId: 'sess-1'
    });

    const res = await request(app).post('/api/v1/auth/token-refresh').send({ refreshToken: 'refresh-1' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBe('token-refresh-1');
    expect(refreshAuthSession).toHaveBeenCalledWith('refresh-1');
  });

  it('POST /api/v1/auth/token-refresh should return 401 when token is missing', async () => {
    const app = createApp();

    const res = await request(app).post('/api/v1/auth/token-refresh').send({});

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('Refresh token khong hop le hoac da het han');
  });

  it('POST /api/v1/auth/register should return 400 when missing email/password', async () => {
    const app = createApp();

    const res = await request(app).post('/api/v1/auth/register').send({ email: 'test@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Thiếu email hoặc password');
  });

  it('POST /api/v1/auth/register should return auth payload when success', async () => {
    const app = createApp();
    vi.mocked(registerUser).mockResolvedValue({
      token: 'token-1',
      accessToken: 'token-1',
      tokenType: 'Bearer',
      expiresIn: 86400,
      method: 'claim_code',
      role: 'USER',
      deviceId: 'd1',
      refreshToken: 'refresh-claim-1',
      refreshExpiresIn: 2592000,
      sessionId: 'sess-claim-1'
    });

    const res = await request(app).post('/api/v1/auth/register').send({ email: 'test@ex.com', password: 'abc', fullName: 'Test', deviceId: 'd1' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBe('token-1');
    expect(registerUser).toHaveBeenCalledWith({ email: 'test@ex.com', password: 'abc', fullName: 'Test', deviceId: 'd1' });
  });

  it('POST /api/v1/auth/login should return auth payload', async () => {
    const app = createApp();
    vi.mocked(loginUser).mockResolvedValue({
      token: 'token-1',
      accessToken: 'token-1',
      tokenType: 'Bearer',
      expiresIn: 86400,
      method: 'claim_code',
      role: 'USER',
      deviceId: 'd1',
      refreshToken: 'refresh-claim-1',
      refreshExpiresIn: 2592000,
      sessionId: 'sess-claim-1'
    });

    const res = await request(app).post('/api/v1/auth/login').send({ email: 'test@ex.com', password: 'abc' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBe('token-1');
    expect(loginUser).toHaveBeenCalled();
  });

  it('POST /api/v1/auth/payment/initiate should return 400 on invalid provider', async () => {
    const app = createApp();

    const res = await request(app).post('/api/v1/auth/payment/initiate')
      .set('Authorization', 'Bearer dummy')
      .send({ paymentMethod: 'bad', amount: 1 });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('provider phải là vnpay hoặc momo');
  });

  it('POST /api/v1/auth/payment/initiate should return payment payload when success', async () => {
    const app = createApp();
    vi.mocked(initiatePayment).mockResolvedValue({
      orderId: 'order-1',
      transactionId: 'order-1',
      provider: 'VNPAY',
      amount: 50000,
      currency: 'VND',
      status: 'PENDING',
      paymentUrl: 'https://pay.local',
      expiresAt: new Date().toISOString(),
      expiresIn: 900
    });

    const res = await request(app)
      .post('/api/v1/auth/payment/initiate')
      .set('Authorization', 'Bearer dummy')
      .send({ paymentMethod: 'vnpay', amount: 50000, deviceId: 'dev1' });

    expect(res.status).toBe(200);
    expect(res.body.orderId).toBe('order-1');
    expect(initiatePayment).toHaveBeenCalled();
  });

  it('POST /api/v1/auth/payment/claim should require auth and call redeemClaimCode', async () => {
    const app = createApp();
    vi.mocked(redeemClaimCode).mockResolvedValue({ success: true, message: 'Nhập mã thành công' });

    const res = await request(app)
      .post('/api/v1/auth/payment/claim')
      .set('Authorization', 'Bearer dummy')
      .send({ code: 'CODE123' });

    expect(res.status).toBe(200);
    expect(redeemClaimCode).toHaveBeenCalledWith('user-1', 'CODE123');
  });

  it('POST /api/v1/auth/payment/callback should validate VNPay signature', async () => {
    const app = createApp();
    const orderId = 'txn_vnpay_1';

    vi.mocked(verifyVNPaySignature).mockReturnValue(true);
    vi.mocked(finalizePayment).mockResolvedValue({
      orderId,
      status: 'SUCCEEDED',
      idempotent: false,
      token: 'jwt-vnpay',
      expiresIn: 86400,
      deviceId: 'dev2'
    });

    const res = await request(app)
      .post('/api/v1/auth/payment/callback')
      .set('x-idempotency-key', 'idem-vnpay')
      .send({
        orderId,
        status: 'success',
        deviceId: 'dev2',
        provider: 'vnpay',
        gatewayPayload: { vnp_SecureHash: 'test-hash' }
      });

    expect(res.status).toBe(200);
    expect(res.body.token).toBe('jwt-vnpay');
    expect(verifyVNPaySignature).toHaveBeenCalled();
  });

  it('POST /api/v1/auth/logout should revoke active session', async () => {
    const app = createApp();
    vi.mocked(revokeAuthSessionByAccessToken).mockResolvedValue();

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', 'Bearer access-token-1');

    expect(res.status).toBe(200);
    expect(revokeAuthSessionByAccessToken).toHaveBeenCalledWith('access-token-1');
  });
});
