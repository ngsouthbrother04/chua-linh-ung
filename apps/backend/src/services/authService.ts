import crypto from 'crypto';
import prisma from '../lib/prisma';
import { PaymentProvider, PaymentStatus } from '../generated/prisma/client';

export interface ClaimAuthResult {
  token: string;
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  method: 'claim_code';
  deviceId?: string;
  refreshToken: string;
  refreshExpiresIn: number;
  sessionId: string;
}

export interface PaymentInitiateInput {
  provider: PaymentProvider;
  amount: number;
  currency?: string;
  deviceId?: string;
  returnUrl?: string;
}

export interface PaymentInitiateResult {
  orderId: string;
  transactionId: string;
  provider: PaymentProvider;
  amount: number;
  currency: 'VND';
  status: 'PENDING';
  paymentUrl: string;
  expiresAt: string;
  expiresIn: number;
}

export interface PaymentFinalizeInput {
  transactionId: string;
  status: 'success' | 'failed' | 'cancelled';
  idempotencyKey: string;
  signatureHash: string;
  deviceId?: string;
}

export interface PaymentFinalizeResult {
  orderId: string;
  status: PaymentStatus;
  idempotent: boolean;
  token?: string;
  expiresIn?: number;
  deviceId?: string;
  refreshToken?: string;
  refreshExpiresIn?: number;
  sessionId?: string;
}

export interface RefreshAuthResult {
  token: string;
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshToken: string;
  refreshExpiresIn: number;
  deviceId?: string;
  sessionId: string;
}

const DEFAULT_CLAIM_CODES = ['ABC123', 'FOODIE2026', 'LINHUNGVIP'];

const TOKEN_TTL_SECONDS = Number(process.env.AUTH_TOKEN_TTL_SECONDS ?? 24 * 60 * 60);
const REFRESH_TOKEN_TTL_SECONDS = Number(process.env.AUTH_REFRESH_TOKEN_TTL_SECONDS ?? 30 * 24 * 60 * 60);

const TOKEN_SECRET = process.env.AUTH_JWT_SECRET ?? 'dev-only-auth-secret-change-me';
const TOKEN_SECRETS = process.env.AUTH_JWT_SECRETS
  ? process.env.AUTH_JWT_SECRETS.split(',').map(s => s.trim()).filter(Boolean)
  : [TOKEN_SECRET];
const CURRENT_KID = process.env.AUTH_JWT_KID ?? '1';
const revokedAccessTokenJtis = new Map<string, number>();

function base64UrlEncode(input: string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwt(payload: Record<string, unknown>): string {
  const header = { alg: 'HS256', typ: 'JWT', kid: CURRENT_KID };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const activeSecret = TOKEN_SECRETS[0] ?? TOKEN_SECRET;

  const signature = crypto
    .createHmac('sha256', activeSecret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${data}.${signature}`;
}

function pruneRevokedAccessTokens(): void {
  const now = Date.now();
  for (const [jti, expiresAtMs] of revokedAccessTokenJtis.entries()) {
    if (expiresAtMs <= now) {
      revokedAccessTokenJtis.delete(jti);
    }
  }
}

function createRefreshToken(subject: string, sessionId?: string): { token: string; expiresIn: number; jti: string } {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const jti = crypto.randomUUID();
  const payload = {
    sub: subject,
    iat: nowSeconds,
    exp: nowSeconds + REFRESH_TOKEN_TTL_SECONDS,
    jti,
    sid: sessionId,
    typ: 'refresh'
  };

  return {
    token: signJwt(payload),
    expiresIn: REFRESH_TOKEN_TTL_SECONDS,
    jti
  };
}

export function verifyJwt(token: string): any {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('INVALID_TOKEN_FORMAT');
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;

  let payloadObj;
  try {
    payloadObj = JSON.parse(Buffer.from(encodedPayload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch (err) {
    throw new Error('INVALID_TOKEN_ENCODING');
  }

  let isValid = false;
  // Key Rotation Vault Check
  for (const secret of TOKEN_SECRETS) {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    try {
      isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
      if (isValid) break;
    } catch {
      continue;
    }
  }

  if (!isValid) {
    throw new Error('INVALID_SIGNATURE');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payloadObj.exp && payloadObj.exp < nowSeconds) {
    throw new Error('TOKEN_EXPIRED');
  }

  return payloadObj;
}

function toSafeClaimCode(rawCode: string): string {
  return rawCode.trim().toUpperCase();
}

export function createAuthToken(subject: string, sessionId?: string): { token: string; expiresIn: number; jti: string } {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const jti = crypto.randomUUID();
  const payload = {
    sub: subject,
    iat: nowSeconds,
    exp: nowSeconds + TOKEN_TTL_SECONDS,
    jti,
    sid: sessionId,
    typ: 'access'
  };

  return {
    token: signJwt(payload),
    expiresIn: TOKEN_TTL_SECONDS,
    jti
  };
}

async function issueAuthPair(input: {
  subject: string;
  deviceId?: string;
  sessionId?: string;
}): Promise<ClaimAuthResult> {
  const sessionId = input.sessionId ?? crypto.randomUUID();
  const access = createAuthToken(input.subject, sessionId);
  const refresh = createRefreshToken(input.subject, sessionId);

  return {
    token: access.token,
    accessToken: access.token,
    tokenType: 'Bearer',
    expiresIn: access.expiresIn,
    method: 'claim_code',
    deviceId: input.deviceId,
    refreshToken: refresh.token,
    refreshExpiresIn: refresh.expiresIn,
    sessionId
  };
}

async function seedDefaultClaimCodes(): Promise<void> {
  const fromEnv = process.env.AUTH_CLAIM_CODES
    ?.split(',')
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);

  const source = fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_CLAIM_CODES;
  await prisma.claimCode.createMany({
    data: source.map((code) => ({ code })),
    skipDuplicates: true
  });
}

export async function claimAccess(claimCode: string, deviceId?: string): Promise<ClaimAuthResult> {
  const normalizedCode = toSafeClaimCode(claimCode);

  if (!/^[A-Z0-9_-]{4,32}$/.test(normalizedCode)) {
    throw new Error('INVALID_CLAIM_CODE');
  }

  await seedDefaultClaimCodes();

  const updated = await prisma.claimCode.updateMany({
    where: {
      code: normalizedCode,
      isUsed: false
    },
    data: {
      isUsed: true,
      usedAt: new Date(),
      usedBy: `claimer:${normalizedCode}`
    }
  });

  if (updated.count === 0) {
    throw new Error('CLAIM_CODE_NOT_FOUND_OR_USED');
  }

  return issueAuthPair({
    subject: `claimer:${normalizedCode}`,
    deviceId: deviceId ?? `claimer:${normalizedCode}`
  });
}

export async function initiatePayment(input: PaymentInitiateInput): Promise<PaymentInitiateResult> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('INVALID_PAYMENT_AMOUNT');
  }

  const transactionId = `txn_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const expiresIn = 15 * 60;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const paymentGatewayBaseUrl = process.env.PAYMENT_GATEWAY_BASE_URL ?? 'https://sandbox.payments.local';
  const callbackUrl = input.returnUrl ?? process.env.PAYMENT_RETURN_URL ?? 'phoamthuc://payment-callback';
  const paymentUrl = `${paymentGatewayBaseUrl}/${input.provider}?transactionId=${encodeURIComponent(
    transactionId
  )}&amount=${encodeURIComponent(input.amount.toString())}&returnUrl=${encodeURIComponent(callbackUrl)}`;

  const created = await prisma.paymentTransaction.create({
    data: {
      transactionId,
      provider: input.provider,
      amount: input.amount,
      currency: 'VND',
      status: 'PENDING',
      returnUrl: callbackUrl,
      paymentUrl,
      expiresAt: new Date(expiresAt)
    }
  });

  return {
    orderId: created.transactionId,
    transactionId: created.transactionId,
    provider: created.provider,
    amount: created.amount,
    currency: 'VND',
    status: 'PENDING',
    paymentUrl: created.paymentUrl,
    expiresAt: created.expiresAt.toISOString(),
    expiresIn
  };
}

export async function finalizePayment(input: PaymentFinalizeInput): Promise<PaymentFinalizeResult> {
  const mappedStatus: PaymentStatus =
    input.status === 'success'
      ? 'SUCCEEDED'
      : input.status === 'failed'
        ? 'FAILED'
        : 'CANCELLED';

  const existingCallback = await prisma.paymentCallbackEvent.findUnique({
    where: { idempotencyKey: input.idempotencyKey }
  });

  if (existingCallback) {
    const existingPayment = await prisma.paymentTransaction.findUnique({
      where: { transactionId: existingCallback.transactionId }
    });

    if (!existingPayment) {
      throw new Error('PAYMENT_NOT_FOUND');
    }

    if (existingPayment.status === 'SUCCEEDED') {
      const pair = await issueAuthPair({
        subject: `payment:${existingPayment.transactionId}`,
        deviceId: input.deviceId ?? `payment:${existingPayment.transactionId}`
      });
      return {
        orderId: existingPayment.transactionId,
        status: existingPayment.status,
        idempotent: true,
        token: pair.token,
        expiresIn: pair.expiresIn,
        refreshToken: pair.refreshToken,
        refreshExpiresIn: pair.refreshExpiresIn,
        sessionId: pair.sessionId,
        deviceId: input.deviceId
      };
    }

    return {
      orderId: existingPayment.transactionId,
      status: existingPayment.status,
      idempotent: true,
      deviceId: input.deviceId
    };
  }

  const existing = await prisma.paymentTransaction.findUnique({
    where: { transactionId: input.transactionId }
  });

  if (!existing) {
    throw new Error('PAYMENT_NOT_FOUND');
  }

  if (
    (existing.status === 'SUCCEEDED' || existing.status === 'FAILED' || existing.status === 'CANCELLED') &&
    existing.status !== mappedStatus
  ) {
    throw new Error('PAYMENT_ALREADY_FINALIZED');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const payment = await tx.paymentTransaction.update({
      where: { transactionId: input.transactionId },
      data: { status: mappedStatus }
    });

    await tx.paymentCallbackEvent.create({
      data: {
        idempotencyKey: input.idempotencyKey,
        transactionId: payment.transactionId,
        provider: payment.provider,
        callbackData: {},
        signatureHash: input.signatureHash,
        status: mappedStatus
      }
    });

    return payment;
  });

  if (mappedStatus !== 'SUCCEEDED') {
    return {
      orderId: updated.transactionId,
      status: mappedStatus,
      idempotent: false,
      deviceId: input.deviceId
    };
  }

  const issued = await issueAuthPair({
    subject: `payment:${updated.transactionId}`,
    deviceId: input.deviceId ?? `payment:${updated.transactionId}`
  });

  return {
    orderId: updated.transactionId,
    status: mappedStatus,
    idempotent: false,
    token: issued.token,
    expiresIn: issued.expiresIn,
    refreshToken: issued.refreshToken,
    refreshExpiresIn: issued.refreshExpiresIn,
    sessionId: issued.sessionId,
    deviceId: input.deviceId
  };
}

export async function refreshAuthSession(rawToken: string): Promise<RefreshAuthResult> {
  const candidate = rawToken.trim();
  if (!candidate) {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  const payload = verifyJwt(candidate);
  const typ = typeof payload.typ === 'string' ? payload.typ : '';

  if (typ !== 'refresh') {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  const subject = typeof payload.sub === 'string' && payload.sub ? payload.sub : 'refresh-token';
  if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  return issueAuthPair({
    subject,
    deviceId: typeof payload.sid === 'string' ? payload.sid : undefined,
    sessionId: typeof payload.sid === 'string' ? payload.sid : undefined
  });
}

export async function revokeAuthSessionByAccessToken(token: string): Promise<void> {
  const payload = verifyJwt(token);
  const jti = typeof payload.jti === 'string' ? payload.jti : '';

  if (!jti) {
    throw new Error('INVALID_SESSION');
  }

  const expiresAt = typeof payload.exp === 'number' ? payload.exp * 1000 : Date.now() + TOKEN_TTL_SECONDS * 1000;
  revokedAccessTokenJtis.set(jti, expiresAt);
}

export async function isAccessTokenSessionActive(token: string): Promise<boolean> {
  try {
    const payload = verifyJwt(token);
    const jti = typeof payload.jti === 'string' ? payload.jti : '';

    if (!jti) {
      return false;
    }

    pruneRevokedAccessTokens();
    return !revokedAccessTokenJtis.has(jti);
  } catch {
    return false;
  }
}
