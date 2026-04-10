import crypto from "crypto";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma";
import { PaymentProvider, PaymentStatus } from "../generated/prisma/client";

export type UserRole = "USER" | "PARTNER" | "ADMIN";

export interface ClaimAuthResult {
  token: string;
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  method: "claim_code";
  role: UserRole;
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
  userId: string;
}

export interface PaymentInitiateResult {
  orderId: string;
  transactionId: string;
  provider: PaymentProvider;
  amount: number;
  currency: "VND";
  status: "PENDING";
  paymentUrl: string;
  expiresAt: string;
  expiresIn: number;
}

export interface PaymentFinalizeInput {
  transactionId: string;
  status: "success" | "failed" | "cancelled";
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
  tokenType: "Bearer";
  expiresIn: number;
  role: UserRole;
  refreshToken: string;
  refreshExpiresIn: number;
  deviceId?: string;
  sessionId: string;
}

export interface ChangePasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

const DEFAULT_CLAIM_CODES = ["ABC123", "FOODIE2026", "LINHUNGVIP"];

const TOKEN_TTL_SECONDS = Number(
  process.env.AUTH_TOKEN_TTL_SECONDS ?? 24 * 60 * 60,
);
const REFRESH_TOKEN_TTL_SECONDS = Number(
  process.env.AUTH_REFRESH_TOKEN_TTL_SECONDS ?? 30 * 24 * 60 * 60,
);

const TOKEN_SECRET =
  process.env.AUTH_JWT_SECRET ?? "dev-only-auth-secret-change-me";
const TOKEN_SECRETS = process.env.AUTH_JWT_SECRETS
  ? process.env.AUTH_JWT_SECRETS.split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : [TOKEN_SECRET];
const CURRENT_KID = process.env.AUTH_JWT_KID ?? "1";
const revokedAccessTokenJtis = new Map<string, number>();
const revokedUserAccessAfterIat = new Map<string, number>();

function base64UrlEncode(input: string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signJwt(payload: Record<string, unknown>): string {
  const header = { alg: "HS256", typ: "JWT", kid: CURRENT_KID };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const activeSecret = TOKEN_SECRETS[0] ?? TOKEN_SECRET;

  const signature = crypto
    .createHmac("sha256", activeSecret)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

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

function toUserRole(value: unknown): UserRole {
  if (value === "ADMIN" || value === "PARTNER" || value === "USER") {
    return value;
  }

  return "USER";
}

function roleFromClaimCodeType(codeType?: string | null): UserRole {
  if (!codeType) {
    return "USER";
  }

  const normalized = codeType.trim().toUpperCase();
  if (normalized === "ADMIN" || normalized === "ADMIN_CODE") {
    return "ADMIN";
  }

  if (normalized === "PARTNER" || normalized === "PARTNER_CODE") {
    return "PARTNER";
  }

  return "USER";
}

async function fetchPersistedUserRole(
  userId: string,
): Promise<UserRole | null> {
  try {
    const rows = await prisma.$queryRaw<Array<{ role: string }>>`
      SELECT role::text AS role
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `;

    if (!rows[0]) {
      return null;
    }

    return toUserRole(rows[0].role);
  } catch {
    return null;
  }
}

async function resolveUserRole(input: {
  userId: string;
  claimCodeId?: string | null;
  fallbackRole?: UserRole;
}): Promise<UserRole> {
  const persistedRole = await fetchPersistedUserRole(input.userId);
  if (persistedRole) {
    return persistedRole;
  }

  if (input.claimCodeId) {
    const claimCode = await prisma.claimCode.findUnique({
      where: { id: input.claimCodeId },
      select: { codeType: true },
    });

    if (claimCode?.codeType) {
      return roleFromClaimCodeType(claimCode.codeType);
    }
  }

  return input.fallbackRole ?? "USER";
}

async function syncUserRoleByClaimCode(
  userId: string,
  claimCodeId?: string | null,
): Promise<UserRole> {
  const role = await resolveUserRole({ userId, claimCodeId });

  try {
    await prisma.$executeRaw`
      UPDATE users
      SET role = ${role}
      WHERE id = ${userId}
    `;
  } catch {
    // Ignore during rollout when role column is not yet deployed.
  }

  return role;
}

function createRefreshToken(
  subject: string,
  role: UserRole,
  sessionId?: string,
): { token: string; expiresIn: number; jti: string } {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const jti = crypto.randomUUID();
  const payload = {
    sub: subject,
    role,
    iat: nowSeconds,
    exp: nowSeconds + REFRESH_TOKEN_TTL_SECONDS,
    jti,
    sid: sessionId,
    typ: "refresh",
  };

  return {
    token: signJwt(payload),
    expiresIn: REFRESH_TOKEN_TTL_SECONDS,
    jti,
  };
}

export function verifyJwt(token: string): any {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("INVALID_TOKEN_FORMAT");
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;

  let payloadObj;
  try {
    payloadObj = JSON.parse(
      Buffer.from(
        encodedPayload.replace(/-/g, "+").replace(/_/g, "/"),
        "base64",
      ).toString("utf8"),
    );
  } catch (err) {
    throw new Error("INVALID_TOKEN_ENCODING");
  }

  let isValid = false;
  // Key Rotation Vault Check
  for (const secret of TOKEN_SECRETS) {
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(data)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    try {
      isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      );
      if (isValid) break;
    } catch {
      continue;
    }
  }

  if (!isValid) {
    throw new Error("INVALID_SIGNATURE");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payloadObj.exp && payloadObj.exp < nowSeconds) {
    throw new Error("TOKEN_EXPIRED");
  }

  return payloadObj;
}

function toSafeClaimCode(rawCode: string): string {
  return rawCode.trim().toUpperCase();
}

export function createAuthToken(
  subject: string,
  sessionId?: string,
  role: UserRole = "USER",
): { token: string; expiresIn: number; jti: string } {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const jti = crypto.randomUUID();
  const payload = {
    sub: subject,
    role,
    iat: nowSeconds,
    exp: nowSeconds + TOKEN_TTL_SECONDS,
    jti,
    sid: sessionId,
    typ: "access",
  };

  return {
    token: signJwt(payload),
    expiresIn: TOKEN_TTL_SECONDS,
    jti,
  };
}

async function issueAuthPair(input: {
  subject: string;
  role: UserRole;
  deviceId?: string;
  sessionId?: string;
}): Promise<ClaimAuthResult> {
  const sessionId = input.sessionId ?? crypto.randomUUID();
  const access = createAuthToken(input.subject, sessionId, input.role);
  const refresh = createRefreshToken(input.subject, input.role, sessionId);

  return {
    token: access.token,
    accessToken: access.token,
    tokenType: "Bearer",
    expiresIn: access.expiresIn,
    method: "claim_code",
    role: input.role,
    deviceId: input.deviceId,
    refreshToken: refresh.token,
    refreshExpiresIn: refresh.expiresIn,
    sessionId,
  };
}

async function seedDefaultClaimCodes(): Promise<void> {
  const fromEnv = process.env.AUTH_CLAIM_CODES?.split(",")
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);

  const source = fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_CLAIM_CODES;
  await prisma.claimCode.createMany({
    data: source.map((code) => ({ code })),
    skipDuplicates: true,
  });
}

export async function registerUser(input: any): Promise<ClaimAuthResult> {
  const { email, password, fullName, deviceId } = input;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error("EMAIL_EXISTS");
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName,
      deviceId,
    },
  });

  const role = await resolveUserRole({
    userId: user.id,
    claimCodeId: user.claimCodeId,
    fallbackRole: "USER",
  });

  return issueAuthPair({
    subject: user.id,
    role,
    deviceId,
  });
}

export async function loginUser(input: any): Promise<ClaimAuthResult> {
  const { email, password, deviceId } = input;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  if (!user.isActive) {
    throw new Error("ACCOUNT_LOCKED");
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new Error("INVALID_CREDENTIALS");
  }

  if (deviceId && user.deviceId !== deviceId) {
    // Optionally update the deviceId
    await prisma.user.update({
      where: { id: user.id },
      data: { deviceId },
    });
  }

  const role = await resolveUserRole({
    userId: user.id,
    claimCodeId: user.claimCodeId,
    fallbackRole: "USER",
  });

  return issueAuthPair({
    subject: user.id,
    role,
    deviceId,
  });
}

export async function changeUserPassword(
  input: ChangePasswordInput,
): Promise<void> {
  const userId = input.userId?.trim();
  const currentPassword = input.currentPassword ?? "";
  const newPassword = input.newPassword ?? "";

  if (!userId || !currentPassword || !newPassword) {
    throw new Error("INVALID_PASSWORD_PAYLOAD");
  }

  if (newPassword.length < 6) {
    throw new Error("PASSWORD_TOO_SHORT");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      passwordHash: true,
    },
  });

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  const isCurrentPasswordValid = await bcrypt.compare(
    currentPassword,
    user.passwordHash,
  );
  if (!isCurrentPasswordValid) {
    throw new Error("INVALID_CURRENT_PASSWORD");
  }

  const nextSalt = await bcrypt.genSalt(10);
  const nextPasswordHash = await bcrypt.hash(newPassword, nextSalt);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: nextPasswordHash,
    },
  });

  await revokeAllUserAccessTokens(user.id);
}

export async function redeemClaimCode(
  userId: string,
  claimCode: string,
): Promise<{ success: boolean; message: string }> {
  const normalizedCode = toSafeClaimCode(claimCode);

  if (!/^[A-Z0-9_-]{4,32}$/.test(normalizedCode)) {
    throw new Error("INVALID_CLAIM_CODE");
  }

  await seedDefaultClaimCodes();

  const updated = await prisma.claimCode.updateMany({
    where: {
      code: normalizedCode,
      isUsed: false,
    },
    data: {
      isUsed: true,
      usedAt: new Date(),
      usedBy: `user:${userId}`,
    },
  });

  if (updated.count === 0) {
    throw new Error("CLAIM_CODE_NOT_FOUND_OR_USED");
  }

  const codeRecord = await prisma.claimCode.findUnique({
    where: { code: normalizedCode },
    select: { id: true, codeType: true },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { claimCodeId: codeRecord?.id },
  });

  await syncUserRoleByClaimCode(userId, codeRecord?.id);

  return {
    success: true,
    message: "Nhập mã thành công. Bạn đã trở thành hội viên Premium.",
  };
}

export async function initiatePayment(
  input: PaymentInitiateInput,
): Promise<PaymentInitiateResult> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("INVALID_PAYMENT_AMOUNT");
  }

  const transactionId = `txn_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const expiresIn = 15 * 60;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const paymentGatewayBaseUrl =
    process.env.PAYMENT_GATEWAY_BASE_URL ?? "https://sandbox.payments.local";
  const callbackUrl =
    input.returnUrl ??
    process.env.PAYMENT_RETURN_URL ??
    "phoamthuc://payment-callback";
  const paymentUrl = `${paymentGatewayBaseUrl}/${input.provider}?transactionId=${encodeURIComponent(
    transactionId,
  )}&amount=${encodeURIComponent(input.amount.toString())}&returnUrl=${encodeURIComponent(callbackUrl)}`;

  const created = await prisma.paymentTransaction.create({
    data: {
      transactionId,
      userId: input.userId,
      provider: input.provider,
      amount: input.amount,
      currency: "VND",
      status: "PENDING",
      returnUrl: callbackUrl,
      paymentUrl,
      expiresAt: new Date(expiresAt),
    },
  });

  return {
    orderId: created.transactionId,
    transactionId: created.transactionId,
    provider: created.provider,
    amount: created.amount,
    currency: "VND",
    status: "PENDING",
    paymentUrl: created.paymentUrl,
    expiresAt: created.expiresAt.toISOString(),
    expiresIn,
  };
}

export async function finalizePayment(
  input: PaymentFinalizeInput,
): Promise<PaymentFinalizeResult> {
  const mappedStatus: PaymentStatus =
    input.status === "success"
      ? "SUCCEEDED"
      : input.status === "failed"
        ? "FAILED"
        : "CANCELLED";

  const existingCallback = await prisma.paymentCallbackEvent.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });

  if (existingCallback) {
    const existingPayment = await prisma.paymentTransaction.findUnique({
      where: { transactionId: existingCallback.transactionId },
    });

    if (!existingPayment) {
      throw new Error("PAYMENT_NOT_FOUND");
    }

    if (existingPayment.status === "SUCCEEDED") {
      const pair = await issueAuthPair({
        subject:
          existingPayment.userId || `payment:${existingPayment.transactionId}`,
        role: existingPayment.userId
          ? await resolveUserRole({
              userId: existingPayment.userId,
              fallbackRole: "USER",
            })
          : "USER",
        deviceId: input.deviceId ?? `payment:${existingPayment.transactionId}`,
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
        deviceId: input.deviceId,
      };
    }

    return {
      orderId: existingPayment.transactionId,
      status: existingPayment.status,
      idempotent: true,
      deviceId: input.deviceId,
    };
  }

  const existing = await prisma.paymentTransaction.findUnique({
    where: { transactionId: input.transactionId },
  });

  if (!existing) {
    throw new Error("PAYMENT_NOT_FOUND");
  }

  if (
    (existing.status === "SUCCEEDED" ||
      existing.status === "FAILED" ||
      existing.status === "CANCELLED") &&
    existing.status !== mappedStatus
  ) {
    throw new Error("PAYMENT_ALREADY_FINALIZED");
  }

  const updated = await prisma.$transaction(async (tx: any) => {
    const payment = await tx.paymentTransaction.update({
      where: { transactionId: input.transactionId },
      data: { status: mappedStatus },
    });

    await tx.paymentCallbackEvent.create({
      data: {
        idempotencyKey: input.idempotencyKey,
        transactionId: payment.transactionId,
        provider: payment.provider,
        callbackData: {},
        signatureHash: input.signatureHash,
        status: mappedStatus,
      },
    });

    return payment;
  });

  if (mappedStatus !== "SUCCEEDED") {
    return {
      orderId: updated.transactionId,
      status: mappedStatus,
      idempotent: false,
      deviceId: input.deviceId,
    };
  }

  const issued = await issueAuthPair({
    subject: updated.userId || `payment:${updated.transactionId}`,
    role: updated.userId
      ? await resolveUserRole({ userId: updated.userId, fallbackRole: "USER" })
      : "USER",
    deviceId: input.deviceId ?? `payment:${updated.transactionId}`,
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
    deviceId: input.deviceId,
  };
}

export async function refreshAuthSession(
  rawToken: string,
): Promise<RefreshAuthResult> {
  const candidate = rawToken.trim();
  if (!candidate) {
    throw new Error("INVALID_REFRESH_TOKEN");
  }

  const payload = verifyJwt(candidate);
  const typ = typeof payload.typ === "string" ? payload.typ : "";

  if (typ !== "refresh") {
    throw new Error("INVALID_REFRESH_TOKEN");
  }

  const subject =
    typeof payload.sub === "string" && payload.sub
      ? payload.sub
      : "refresh-token";
  const roleFromToken = toUserRole(payload.role);
  if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) {
    throw new Error("INVALID_REFRESH_TOKEN");
  }

  const resolvedRole = subject.startsWith("payment:")
    ? roleFromToken
    : await resolveUserRole({
        userId: subject,
        fallbackRole: roleFromToken,
      });

  if (!subject.startsWith("payment:")) {
    const rows = await prisma.$queryRaw<Array<{ is_active: boolean }>>`
      SELECT is_active
      FROM users
      WHERE id = ${subject}
      LIMIT 1
    `;

    if (!rows[0] || !rows[0].is_active) {
      throw new Error("ACCOUNT_LOCKED");
    }
  }

  return issueAuthPair({
    subject,
    role: resolvedRole,
    deviceId: typeof payload.sid === "string" ? payload.sid : undefined,
    sessionId: typeof payload.sid === "string" ? payload.sid : undefined,
  });
}

export async function revokeAuthSessionByAccessToken(
  token: string,
): Promise<void> {
  const payload = verifyJwt(token);
  const jti = typeof payload.jti === "string" ? payload.jti : "";

  if (!jti) {
    throw new Error("INVALID_SESSION");
  }

  const expiresAt =
    typeof payload.exp === "number"
      ? payload.exp * 1000
      : Date.now() + TOKEN_TTL_SECONDS * 1000;
  revokedAccessTokenJtis.set(jti, expiresAt);
}

export async function revokeAllUserAccessTokens(userId: string): Promise<void> {
  const normalized = typeof userId === "string" ? userId.trim() : "";
  if (!normalized) {
    throw new Error("INVALID_USER_ID");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  revokedUserAccessAfterIat.set(normalized, nowSeconds);

  try {
    await prisma.$executeRaw`
      UPDATE users
      SET token_invalid_before = NOW(), updated_at = NOW()
      WHERE id = ${normalized}
    `;
  } catch {
    // Keep in-memory fallback for rollout windows where DB schema is not fully migrated.
  }
}

export async function getCurrentUserRole(
  userId: string,
): Promise<UserRole | null> {
  const normalized = typeof userId === "string" ? userId.trim() : "";
  if (!normalized) {
    return null;
  }

  return fetchPersistedUserRole(normalized);
}

export async function isAccessTokenSessionActive(
  token: string,
): Promise<boolean> {
  try {
    const payload = verifyJwt(token);
    const jti = typeof payload.jti === "string" ? payload.jti : "";

    if (!jti) {
      return false;
    }

    pruneRevokedAccessTokens();
    if (revokedAccessTokenJtis.has(jti)) {
      return false;
    }

    const subject = typeof payload.sub === "string" ? payload.sub : "";
    const issuedAt = typeof payload.iat === "number" ? payload.iat : 0;
    if (!subject || issuedAt <= 0) {
      return true;
    }

    try {
      const rows = await prisma.$queryRaw<
        Array<{ cutoff: number | null; is_active: boolean }>
      >`
        SELECT EXTRACT(EPOCH FROM token_invalid_before)::bigint AS cutoff, is_active
        FROM users
        WHERE id = ${subject}
        LIMIT 1
      `;

      if (rows[0] && !rows[0].is_active) {
        return false;
      }

      const dbCutoff = rows[0]?.cutoff;
      if (typeof dbCutoff === "number" && issuedAt <= dbCutoff) {
        return false;
      }
    } catch {
      // Ignore DB lookup failures and fallback to in-memory cutoff below.
    }

    const revokeAfter = revokedUserAccessAfterIat.get(subject);
    if (typeof revokeAfter === "number" && issuedAt <= revokeAfter) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export async function isUserPremium(userId: string): Promise<boolean> {
  if (!userId) return false;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      paymentTransactions: {
        where: { status: "SUCCEEDED" },
        take: 1,
      },
    },
  });
  if (!user) return false;
  return user.claimCodeId !== null || user.paymentTransactions.length > 0;
}
