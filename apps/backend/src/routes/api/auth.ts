import { Router } from 'express';
import crypto from 'crypto';
import { PaymentProvider } from '../../generated/prisma/client';
import {
  claimAccess,
  finalizePayment,
  initiatePayment,
  refreshAuthSession,
  revokeAuthSessionByAccessToken
} from '../../services/authService';
import { verifyVNPaySignature, verifyMoMoSignature } from '../../utils/paymentVerifier';
import asyncHandler from '../../utils/asyncHandler';
import ApiError from '../../utils/ApiError';

const router = Router();
const CALLBACK_TTL_SECONDS = Number(process.env.PAYMENT_CALLBACK_MAX_AGE_SECONDS ?? 300);

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
  '/claim',
  asyncHandler(async (req, res) => {
  const claimCodeRaw =
    typeof req.body?.code === 'string'
      ? req.body.code
      : typeof req.body?.claimCode === 'string'
        ? req.body.claimCode
        : '';
  const deviceId = typeof req.body?.deviceId === 'string' ? req.body.deviceId : undefined;

  if (!claimCodeRaw) {
    throw new ApiError(400, 'Thiếu code hoặc claimCode.');
  }

  const authData = await claimAccess(claimCodeRaw, deviceId);
  return res.status(200).json({
    message: 'Xác thực thành công.',
    ...authData
  });
})
);

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

router.post(
  '/payment/initiate',
  asyncHandler(async (req, res) => {
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

  const payment = await initiatePayment({
    provider,
    amount,
    currency,
    deviceId,
    returnUrl
  });

  return res.status(200).json({
    message: 'Khởi tạo thanh toán thành công.',
    ...payment
  });
})
);

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
