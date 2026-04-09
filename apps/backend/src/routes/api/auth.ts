import { Router } from 'express';
import crypto from 'crypto';
import { PaymentProvider } from '../../generated/prisma/client';
import {
  registerUser,
  loginUser,
  redeemClaimCode,
  finalizePayment,
  initiatePayment,
  refreshAuthSession,
  revokeAuthSessionByAccessToken
} from '../../services/authService';
import { verifyVNPaySignature, verifyMoMoSignature } from '../../utils/paymentVerifier';
import { requireAuth, requireRole, AuthRequest } from '../../middlewares/authMiddleware';
import asyncHandler from '../../utils/asyncHandler';
import ApiError from '../../utils/ApiError';

const router = Router();
const CALLBACK_TTL_SECONDS = Number(process.env.PAYMENT_CALLBACK_MAX_AGE_SECONDS ?? 300);

/**
 * POST /api/v1/auth/register
 * @summary Register a new account
 * @description Create a user account using email and password.
 * @tags Auth
 * @param {object} request.body.required - Registration payload
 * @param {string} request.body.email.required - User email
 * @param {string} request.body.password.required - User password
 * @param {string} request.body.fullName - Full name
 * @param {string} request.body.deviceId - Device identifier
 * @return {object} 201 - Registration successful
 * @return {object} 400 - Invalid payload
 * @return {object} 500 - Internal Server Error
 */

function extractBearerToken(headerValue: unknown): string {
  if (typeof headerValue !== 'string' || !headerValue.startsWith('Bearer ')) {
    return '';
  }

  return headerValue.slice('Bearer '.length).trim();
}

function verifyCallbackSignature(params: {
  transactionId: string;
  status: string;
  deviceId?: string;
  timestamp: string;
  signature: string;
}): boolean {
  const secret = process.env.PAYMENT_CALLBACK_SECRET ?? '';
  if (!secret) {
    return false;
  }

  const payload = [params.transactionId, params.status, params.deviceId ?? '', params.timestamp].join('|');
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const provided = params.signature.toLowerCase();

  if (provided.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { email, password, fullName, deviceId } = req.body;
    if (!email || !password) {
      throw new ApiError(400, 'Thiếu email hoặc password.');
    }
    const authData = await registerUser({ email, password, fullName, deviceId });
    return res.status(201).json({
      message: 'Đăng ký thành công.',
      ...authData
    });
  })
);

/**
 * POST /api/v1/auth/login
 * @summary Login with email and password
 * @description Authenticate user and return access/refresh tokens.
 * @tags Auth
 * @param {object} request.body.required - Login payload
 * @param {string} request.body.email.required - User email
 * @param {string} request.body.password.required - User password
 * @param {string} request.body.deviceId - Device identifier
 * @return {object} 200 - Login successful
 * @return {object} 400 - Invalid payload
 * @return {object} 401 - Unauthorized
 * @return {object} 500 - Internal Server Error
 */

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password, deviceId } = req.body;
    if (!email || !password) {
      throw new ApiError(400, 'Thiếu email hoặc password.');
    }
    const authData = await loginUser({ email, password, deviceId });
    return res.status(200).json({
      message: 'Đăng nhập thành công.',
      ...authData
    });
  })
);

/**
 * POST /api/v1/auth/payment/claim
 * @summary Redeem claim code
 * @description Redeem access code for authenticated user.
 * @tags Auth
 * @security bearerAuth
 * @param {object} request.body.required - Claim payload
 * @param {string} request.body.code - Claim code
 * @param {string} request.body.claimCode - Alternative claim code field
 * @return {object} 200 - Claim successful
 * @return {object} 400 - Missing code
 * @return {object} 401 - Unauthorized
 * @return {object} 500 - Internal Server Error
 */

router.post(
  '/payment/claim',
  requireAuth,
  requireRole(['USER']),
  asyncHandler(async (req: AuthRequest, res) => {
    const claimCodeRaw = req.body?.code || req.body?.claimCode || '';
    if (!claimCodeRaw) {
      throw new ApiError(400, 'Thiếu code.');
    }
    const userId = req.user?.sub;
    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }
    const result = await redeemClaimCode(userId, claimCodeRaw);
    return res.status(200).json(result);
  })
);

/**
 * POST /api/v1/auth/token-refresh
 * @summary Refresh access token
 * @description Refresh auth session by refresh token in request body.
 * @tags Auth
 * @param {object} request.body.required - Refresh payload
 * @param {string} request.body.refreshToken.required - Refresh token
 * @return {object} 200 - Token refreshed
 * @return {object} 401 - Invalid or expired refresh token
 * @return {object} 500 - Internal Server Error
 */

router.post(
  '/token-refresh',
  asyncHandler(async (req, res) => {
    const refreshTokenRaw = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : '';

    if (!refreshTokenRaw) {
      throw new ApiError(401, 'Refresh token khong hop le hoac da het han.');
    }

    try {
      const refreshed = await refreshAuthSession(refreshTokenRaw);
      return res.status(200).json({
        message: 'Làm mới phiên đăng nhập thành công.',
        ...refreshed
      });
    } catch {
      throw new ApiError(401, 'Refresh token khong hop le hoac da het han.');
    }
  })
);

/**
 * POST /api/v1/auth/payment/initiate
 * @summary Initiate payment transaction
 * @description Create payment transaction for authenticated user.
 * @tags Auth
 * @security bearerAuth
 * @param {object} request.body.required - Payment init payload
 * @param {string} request.body.provider - Payment provider (vnpay or momo)
 * @param {string} request.body.paymentMethod - Alternative provider field
 * @param {number} request.body.amount.required - Payment amount
 * @param {string} request.body.currency - Currency code
 * @param {string} request.body.deviceId - Device identifier
 * @param {string} request.body.returnUrl - Return URL
 * @return {object} 200 - Payment initialized
 * @return {object} 400 - Invalid provider or payload
 * @return {object} 401 - Unauthorized
 * @return {object} 500 - Internal Server Error
 */

router.post(
  '/payment/initiate',
  requireAuth,
  requireRole(['USER']),
  asyncHandler(async (req: AuthRequest, res) => {
    const providerRaw =
      typeof req.body?.paymentMethod === 'string'
        ? req.body.paymentMethod.toLowerCase()
        : typeof req.body?.provider === 'string'
          ? req.body.provider.toLowerCase()
          : '';
    const amount = Number(req.body?.amount);
    const currency = typeof req.body?.currency === 'string' ? req.body.currency : 'VND';
    const deviceId = typeof req.body?.deviceId === 'string' ? req.body.deviceId : undefined;
    const returnUrl = typeof req.body?.returnUrl === 'string' ? req.body.returnUrl : undefined;

    const provider =
      providerRaw === 'vnpay'
        ? PaymentProvider.VNPAY
        : providerRaw === 'momo'
          ? PaymentProvider.MOMO
          : undefined;

    if (!provider) {
      throw new ApiError(400, 'provider phải là vnpay hoặc momo.');
    }

    const userId = req.user?.sub;
    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }

    const payment = await initiatePayment({
      provider,
      amount,
      currency,
      deviceId,
      returnUrl,
      userId
    });

    return res.status(200).json({
      message: 'Khởi tạo thanh toán thành công.',
      ...payment
    });
  })
);

/**
 * POST /api/v1/auth/logout
 * @summary Logout current session
 * @description Revoke current access token from Authorization header or body.
 * @tags Auth
 * @security bearerAuth
 * @param {object} request.body - Optional body payload
 * @param {string} request.body.token - Fallback access token when header is absent
 * @return {object} 200 - Logout successful
 * @return {object} 401 - Missing or invalid token
 * @return {object} 500 - Internal Server Error
 */

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const accessToken = extractBearerToken(req.headers.authorization) || (typeof req.body?.token === 'string' ? req.body.token : '');

    if (!accessToken) {
      throw new ApiError(401, 'Thiếu hoặc sai định dạng Authorization Bearer token.');
    }

    try {
      await revokeAuthSessionByAccessToken(accessToken);
      return res.status(200).json({
        message: 'Dang xuat thanh cong'
      });
    } catch {
      throw new ApiError(401, 'Token khong hop le hoac da het han.');
    }
  })
);

/**
 * POST /api/v1/auth/payment/callback
 * @summary Handle payment callback
 * @description Validate provider/internal callback signature and finalize transaction.
 * @tags Auth
 * @param {string} x-idempotency-key.header.required - Idempotency key
 * @param {string} x-callback-signature.header - Internal callback signature
 * @param {string} x-callback-timestamp.header - Internal callback timestamp in ms
 * @param {object} request.body.required - Callback payload
 * @param {string} request.body.orderId - Provider order id
 * @param {string} request.body.transactionId - Internal transaction id
 * @param {string} request.body.status.required - success, failed, or cancelled
 * @param {string} request.body.provider - vnpay or momo
 * @param {object} request.body.gatewayPayload - Raw provider callback payload
 * @param {string} request.body.deviceId - Device identifier
 * @return {object} 200 - Callback accepted and processed
 * @return {object} 400 - Invalid callback payload
 * @return {object} 401 - Invalid callback signature
 * @return {object} 500 - Internal Server Error
 */

router.post(
  '/payment/callback',
  asyncHandler(async (req, res) => {
    const transactionIdRaw =
      typeof req.body?.orderId === 'string'
        ? req.body.orderId
        : typeof req.body?.transactionId === 'string'
          ? req.body.transactionId
          : '';
    const statusRaw = typeof req.body?.status === 'string' ? req.body.status.toLowerCase() : '';
    const deviceId = typeof req.body?.deviceId === 'string' ? req.body.deviceId : undefined;
    const idempotencyKeyHeader = req.headers['x-idempotency-key'];
    const signatureHeader = req.headers['x-callback-signature'];
    const timestampHeader = req.headers['x-callback-timestamp'];

    const idempotencyKey = typeof idempotencyKeyHeader === 'string' ? idempotencyKeyHeader : '';
    const signature = typeof signatureHeader === 'string' ? signatureHeader : '';
    const timestamp = typeof timestampHeader === 'string' ? timestampHeader : '';

    const providerRaw = typeof req.body?.provider === 'string' ? req.body.provider.toLowerCase() : '';
    const gatewayPayload = typeof req.body?.gatewayPayload === 'object' && req.body.gatewayPayload !== null ? req.body.gatewayPayload : undefined;

    const status =
      statusRaw === 'success' || statusRaw === 'succeeded'
        ? 'success'
        : statusRaw === 'failed' || statusRaw === 'fail'
          ? 'failed'
          : statusRaw === 'cancelled' || statusRaw === 'canceled'
            ? 'cancelled'
            : undefined;

    if (!transactionIdRaw || !status) {
      throw new ApiError(400, 'Thiếu transactionId/orderId hoặc status không hợp lệ.');
    }

    if (!idempotencyKey) {
      throw new ApiError(400, 'Thiếu x-idempotency-key.');
    }

    let validSignature = false;
    let signatureHashToSave = signature;

    if (providerRaw === 'vnpay' && gatewayPayload) {
      validSignature = verifyVNPaySignature(gatewayPayload as Record<string, string>);
      signatureHashToSave = (gatewayPayload as Record<string, string>)['vnp_SecureHash'] || 'vnpay-validated';
    } else if (providerRaw === 'momo' && gatewayPayload) {
      validSignature = verifyMoMoSignature(gatewayPayload as Record<string, string>);
      signatureHashToSave = (gatewayPayload as Record<string, string>)['signature'] || 'momo-validated';
    } else {
      if (!signature || !timestamp) {
        throw new ApiError(400, 'Thiếu xác thực (gatewayPayload hoặc x-callback-signature/timestamp).');
      }

      const callbackTimestampMs = Number(timestamp);
      if (!Number.isFinite(callbackTimestampMs)) {
        throw new ApiError(400, 'x-callback-timestamp không hợp lệ.');
      }

      const nowMs = Date.now();
      if (Math.abs(nowMs - callbackTimestampMs) > CALLBACK_TTL_SECONDS * 1000) {
        throw new ApiError(401, 'Callback đã quá hạn hoặc lệch thời gian cho phép.');
      }

      validSignature = verifyCallbackSignature({
        transactionId: transactionIdRaw,
        status,
        deviceId,
        timestamp,
        signature
      });
    }

    if (!validSignature) {
      throw new ApiError(401, 'Chữ ký callback (gateway hoặc internal) không hợp lệ.');
    }

    const finalized = await finalizePayment({
      transactionId: transactionIdRaw,
      status,
      idempotencyKey,
      signatureHash: signatureHashToSave,
      deviceId
    });

    if (finalized.status === 'SUCCEEDED') {
      return res.status(200).json({
        token: finalized.token,
        expiresIn: finalized.expiresIn,
        deviceId: finalized.deviceId,
        orderId: finalized.orderId,
        status: finalized.status
      });
    }

    return res.status(200).json({
      orderId: finalized.orderId,
      status: finalized.status,
      deviceId: finalized.deviceId
    });
  })
);

export default router;
