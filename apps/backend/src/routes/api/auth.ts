import { Router } from "express";
import crypto from "crypto";
import { PaymentProvider } from "../../generated/prisma/client";
import {
  registerUser,
  loginUser,
  changeUserPassword,
  finalizePayment,
  initiatePayment,
  refreshAuthSession,
  revokeAuthSessionByAccessToken,
} from "../../services/authService";
import { verifyMoMoSignature } from "../../utils/paymentVerifier";
import {
  getPaymentPackageByCode,
  getUserActivePaymentPackageEntitlement,
  listPaymentPackages,
} from "../../services/paymentPackageService";
import {
  requireAuth,
  requireRole,
  AuthRequest,
} from "../../middlewares/authMiddleware";
import asyncHandler from "../../utils/asyncHandler";
import ApiError from "../../utils/ApiError";
import { synthesizePreviewAudioFromText } from "../../services/ttsService";
import { userController } from "../../controllers/userController";

const router = Router();
const CALLBACK_TTL_SECONDS = Number(
  process.env.PAYMENT_CALLBACK_MAX_AGE_SECONDS ?? 300,
);

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
  if (typeof headerValue !== "string" || !headerValue.startsWith("Bearer ")) {
    return "";
  }

  return headerValue.slice("Bearer ".length).trim();
}

function verifyCallbackSignature(params: {
  transactionId: string;
  status: string;
  deviceId?: string;
  timestamp: string;
  signature: string;
}): boolean {
  const secret = process.env.PAYMENT_CALLBACK_SECRET ?? "";
  if (!secret) {
    return false;
  }

  const payload = [
    params.transactionId,
    params.status,
    params.deviceId ?? "",
    params.timestamp,
  ].join("|");
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  const provided = params.signature.toLowerCase();

  if (provided.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { email, password, fullName, deviceId } = req.body;
    if (!email || !password) {
      throw new ApiError(400, "Thiếu email hoặc password.");
    }
    const authData = await registerUser({
      email,
      password,
      fullName,
      deviceId,
    });
    return res.status(201).json({
      message: "Đăng ký thành công.",
      ...authData,
    });
  }),
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
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password, deviceId } = req.body;
    if (!email || !password) {
      throw new ApiError(400, "Thiếu email hoặc password.");
    }
    let authData;
    try {
      authData = await loginUser({ email, password, deviceId });
    } catch (error) {
      const code = error instanceof Error ? error.message : "UNKNOWN";

      if (code === "INVALID_CREDENTIALS") {
        throw new ApiError(401, "Email hoặc mật khẩu không đúng.");
      }

      if (code === "ACCOUNT_LOCKED") {
        throw new ApiError(403, "Tài khoản đã bị khóa.");
      }

      throw error;
    }

    return res.status(200).json({
      message: "Đăng nhập thành công.",
      ...authData,
    });
  }),
);

/**
 * POST /api/v1/auth/change-password
 * @summary Change current user password
 * @description Verify current password and update to a new password.
 * @tags Auth
 * @security bearerAuth
 * @param {object} request.body.required - Change password payload
 * @param {string} request.body.currentPassword.required - Current password
 * @param {string} request.body.newPassword.required - New password
 * @return {object} 200 - Password changed successfully
 * @return {object} 400 - Invalid payload or current password mismatch
 * @return {object} 401 - Unauthorized
 */
router.post(
  "/change-password",
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user?.sub;
    const currentPassword =
      typeof req.body?.currentPassword === "string"
        ? req.body.currentPassword
        : "";
    const newPassword =
      typeof req.body?.newPassword === "string" ? req.body.newPassword : "";

    if (!userId) {
      throw new ApiError(401, "Unauthorized");
    }

    if (!currentPassword || !newPassword) {
      throw new ApiError(400, "Thiếu currentPassword hoặc newPassword.");
    }

    try {
      await changeUserPassword({
        userId,
        currentPassword,
        newPassword,
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "UNKNOWN";

      if (code === "INVALID_CURRENT_PASSWORD") {
        throw new ApiError(400, "Mật khẩu hiện tại không đúng.");
      }

      if (code === "PASSWORD_TOO_SHORT") {
        throw new ApiError(400, "Mật khẩu mới phải có ít nhất 6 ký tự.");
      }

      if (code === "INVALID_PASSWORD_PAYLOAD") {
        throw new ApiError(400, "Dữ liệu đổi mật khẩu không hợp lệ.");
      }

      throw error;
    }

    return res.status(200).json({
      message: "Đổi mật khẩu thành công. Vui lòng đăng nhập lại.",
    });
  }),
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
  "/tts-preview",
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const text = typeof req.body?.text === "string" ? req.body.text : "";
    const language =
      typeof req.body?.language === "string" ? req.body.language : "auto";

    if (!text.trim()) {
      throw new ApiError(400, "Thiếu mô tả để tạo audio test.");
    }

    try {
      const { audioBuffer, language: normalizedLanguage } =
        await synthesizePreviewAudioFromText(text, language);

      res.setHeader("Content-Type", "audio/wav");
      res.setHeader("Content-Length", String(audioBuffer.length));
      res.setHeader(
        "Content-Disposition",
        `inline; filename="tts-preview-${normalizedLanguage}.wav"`,
      );

      return res.status(200).send(audioBuffer);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "TTS_GENERATION_FAILED";

      if (message === "TTS_TEXT_TOO_LONG") {
        throw new ApiError(400, "Mô tả quá dài (tối đa 2000 ký tự).");
      }

      if (message === "TTS_LANGUAGE_NOT_SUPPORTED") {
        throw new ApiError(400, "Ngôn ngữ TTS chưa được hỗ trợ.");
      }

      if (message.startsWith("GOOGLE_TTS_") || message.startsWith("TTS_")) {
        throw new ApiError(500, "Google TTS runtime lỗi khi sinh audio.");
      }

      throw new ApiError(500, "Không thể tạo audio test từ mô tả.");
    }
  }),
);

router.post(
  "/token-refresh",
  asyncHandler(async (req, res) => {
    const refreshTokenRaw =
      typeof req.body?.refreshToken === "string" ? req.body.refreshToken : "";

    if (!refreshTokenRaw) {
      throw new ApiError(401, "Refresh token khong hop le hoac da het han.");
    }

    try {
      const refreshed = await refreshAuthSession(refreshTokenRaw);
      return res.status(200).json({
        message: "Làm mới phiên đăng nhập thành công.",
        ...refreshed,
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "UNKNOWN";
      if (code === "ACCOUNT_LOCKED") {
        throw new ApiError(403, "Tài khoản đã bị khóa.");
      }
      throw new ApiError(401, "Refresh token khong hop le hoac da het han.");
    }
  }),
);

/**
 * POST /api/v1/auth/payment/initiate
 * @summary Initiate payment transaction
 * @description Create payment transaction for authenticated user.
 * @tags Auth
 * @security bearerAuth
 * @param {object} request.body.required - Payment init payload
 * @param {string} request.body.provider - Payment provider (momo)
 * @param {string} request.body.paymentMethod - Alternative provider field (momo)
 * @param {string} request.body.packageCode - Package code created by admin
 * @param {number} request.body.amount.required - Payment amount
 * @param {string} request.body.currency - Currency code
 * @param {string} request.body.deviceId - Device identifier
 * @param {string} request.body.returnUrl - Return URL
 * @return {object} 200 - Payment initialized
 * @return {object} 400 - Invalid provider or payload
 * @return {object} 401 - Unauthorized
 * @return {object} 500 - Internal Server Error
 */
// Định nghĩa các endpoint cho quên mật khẩu
router.post('/forgot-password', userController.forgotPassword);
router.post('/reset-password', userController.resetPassword);

router.post(
  "/payment/initiate",
  requireAuth,
  requireRole(["USER", "PARTNER"]),
  asyncHandler(async (req: AuthRequest, res) => {
    const packageCode =
      typeof req.body?.packageCode === "string" ? req.body.packageCode : "";
    const providerRaw =
      typeof req.body?.paymentMethod === "string"
        ? req.body.paymentMethod.toLowerCase()
        : typeof req.body?.provider === "string"
          ? req.body.provider.toLowerCase()
          : "momo";
    let amount = Number(req.body?.amount);
    let currency =
      typeof req.body?.currency === "string" ? req.body.currency : "VND";
    const deviceId =
      typeof req.body?.deviceId === "string" ? req.body.deviceId : undefined;
    const returnUrl =
      typeof req.body?.returnUrl === "string" ? req.body.returnUrl : undefined;

    if (providerRaw !== "momo") {
      throw new ApiError(400, "provider hiện chỉ hỗ trợ momo.");
    }

    const userId = req.user?.sub;
    if (!userId) {
      throw new ApiError(401, "Unauthorized");
    }

    if (packageCode.trim()) {
      const selectedPackage = await getPaymentPackageByCode(packageCode);
      amount = selectedPackage.amount;
      currency = selectedPackage.currency;

      const payment = await initiatePayment({
        amount,
        currency,
        deviceId,
        returnUrl,
        userId,
        metadata: {
          packageCode: selectedPackage.code,
          packageName: selectedPackage.name,
          poiQuota: selectedPackage.poiQuota,
          durationDays: selectedPackage.durationDays,
        },
      });

      return res.status(200).json({
        message: "Khởi tạo thanh toán thành công.",
        packageCode: packageCode.trim() || undefined,
        packageName: selectedPackage.name,
        poiQuota: selectedPackage.poiQuota,
        ...payment,
      });
    }

    const payment = await initiatePayment({
      amount,
      currency,
      deviceId,
      returnUrl,
      userId,
    });

    return res.status(200).json({
      message: "Khởi tạo thanh toán thành công.",
      packageCode: packageCode.trim() || undefined,
      ...payment,
    });
  }),
);

/**
 * GET /api/v1/auth/payment/packages
 * @summary Get active payment package list
 * @description Return all active packages configured by admin.
 * @tags Auth
 * @return {object} 200 - Active package list
 * @return {object} 500 - Internal Server Error
 */
router.get(
  "/payment/packages",
  asyncHandler(async (_req, res) => {
    const items = await listPaymentPackages({ includeInactive: false });
    return res.status(200).json({
      items,
      total: items.length,
    });
  }),
);

/**
 * GET /api/v1/auth/payment/entitlement
 * @summary Get current user's active payment package entitlement
 * @tags Auth
 * @security bearerAuth
 * @return {object} 200 - Entitlement info
 * @return {object} 401 - Unauthorized
 * @return {object} 500 - Internal Server Error
 */
router.get(
  "/payment/entitlement",
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user?.sub;
    if (!userId) {
      throw new ApiError(401, "Unauthorized");
    }

    const entitlement = await getUserActivePaymentPackageEntitlement(userId);
    return res.status(200).json({
      data: entitlement,
    });
  }),
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
  "/logout",
  asyncHandler(async (req, res) => {
    const accessToken =
      extractBearerToken(req.headers.authorization) ||
      (typeof req.body?.token === "string" ? req.body.token : "");

    if (!accessToken) {
      throw new ApiError(
        401,
        "Thiếu hoặc sai định dạng Authorization Bearer token.",
      );
    }

    try {
      await revokeAuthSessionByAccessToken(accessToken);
      return res.status(200).json({
        message: "Dang xuat thanh cong",
      });
    } catch {
      throw new ApiError(401, "Token khong hop le hoac da het han.");
    }
  }),
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
 * @param {string} request.body.provider - momo
 * @param {object} request.body.gatewayPayload - Raw provider callback payload
 * @param {string} request.body.deviceId - Device identifier
 * @return {object} 200 - Callback accepted and processed
 * @return {object} 400 - Invalid callback payload
 * @return {object} 401 - Invalid callback signature
 * @return {object} 500 - Internal Server Error
 */

router.post(
  "/payment/callback",
  asyncHandler(async (req, res) => {
    const isMoMoIpnPayload =
      typeof req.body?.partnerCode === "string" &&
      typeof req.body?.orderId === "string" &&
      typeof req.body?.signature === "string";

    const transactionIdRaw =
      typeof req.body?.orderId === "string"
        ? req.body.orderId
        : typeof req.body?.transactionId === "string"
          ? req.body.transactionId
          : "";
    const statusRaw =
      typeof req.body?.status === "string" ? req.body.status.toLowerCase() : "";
    const deviceId =
      typeof req.body?.deviceId === "string" ? req.body.deviceId : undefined;
    const idempotencyKeyHeader = req.headers["x-idempotency-key"];
    const signatureHeader = req.headers["x-callback-signature"];
    const timestampHeader = req.headers["x-callback-timestamp"];

    const rawIdempotencyKey =
      typeof idempotencyKeyHeader === "string" ? idempotencyKeyHeader : "";
    const signature =
      typeof signatureHeader === "string" ? signatureHeader : "";
    const timestamp =
      typeof timestampHeader === "string" ? timestampHeader : "";

    const providerRaw =
      typeof req.body?.provider === "string"
        ? req.body.provider.toLowerCase()
        : isMoMoIpnPayload
          ? "momo"
          : "";
    const gatewayPayload =
      typeof req.body?.gatewayPayload === "object" &&
      req.body.gatewayPayload !== null
        ? req.body.gatewayPayload
        : undefined;

    const momoResultCode =
      typeof req.body?.resultCode === "number"
        ? req.body.resultCode
        : typeof req.body?.resultCode === "string"
          ? Number(req.body.resultCode)
          : undefined;

    const status = isMoMoIpnPayload
      ? momoResultCode === 0
        ? "success"
        : "failed"
      : statusRaw === "success" || statusRaw === "succeeded"
        ? "success"
        : statusRaw === "failed" || statusRaw === "fail"
          ? "failed"
          : statusRaw === "cancelled" || statusRaw === "canceled"
            ? "cancelled"
            : undefined;

    if (!transactionIdRaw || !status) {
      throw new ApiError(
        400,
        "Thiếu transactionId/orderId hoặc status không hợp lệ.",
      );
    }

    const idempotencyKey = isMoMoIpnPayload
      ? [
          "momo",
          typeof req.body?.requestId === "string"
            ? req.body.requestId
            : transactionIdRaw,
          typeof req.body?.transId === "string"
            ? req.body.transId
            : String(req.body?.transId ?? ""),
          String(momoResultCode ?? "unknown"),
        ].join(":")
      : rawIdempotencyKey;

    if (!idempotencyKey) {
      throw new ApiError(400, "Thiếu x-idempotency-key.");
    }

    let validSignature = false;
    let signatureHashToSave = signature;

    if (isMoMoIpnPayload) {
      const momoPayloadRecord = Object.fromEntries(
        Object.entries(req.body ?? {}).map(([key, value]) => [
          key,
          value === undefined || value === null ? "" : String(value),
        ]),
      ) as Record<string, string>;

      validSignature = verifyMoMoSignature(momoPayloadRecord);
      signatureHashToSave = momoPayloadRecord.signature || "momo-validated";
    } else if (providerRaw === "momo" && gatewayPayload) {
      validSignature = verifyMoMoSignature(
        gatewayPayload as Record<string, string>,
      );
      signatureHashToSave =
        (gatewayPayload as Record<string, string>)["signature"] ||
        "momo-validated";
    } else {
      if (!signature || !timestamp) {
        throw new ApiError(
          400,
          "Thiếu xác thực (gatewayPayload hoặc x-callback-signature/timestamp).",
        );
      }

      const callbackTimestampMs = Number(timestamp);
      if (!Number.isFinite(callbackTimestampMs)) {
        throw new ApiError(400, "x-callback-timestamp không hợp lệ.");
      }

      const nowMs = Date.now();
      if (Math.abs(nowMs - callbackTimestampMs) > CALLBACK_TTL_SECONDS * 1000) {
        throw new ApiError(
          401,
          "Callback đã quá hạn hoặc lệch thời gian cho phép.",
        );
      }

      validSignature = verifyCallbackSignature({
        transactionId: transactionIdRaw,
        status,
        deviceId,
        timestamp,
        signature,
      });
    }

    if (!validSignature) {
      throw new ApiError(
        401,
        "Chữ ký callback (gateway hoặc internal) không hợp lệ.",
      );
    }

    const finalized = await finalizePayment({
      transactionId: transactionIdRaw,
      status,
      idempotencyKey,
      signatureHash: signatureHashToSave,
      deviceId,
    });

    if (finalized.status === "SUCCEEDED") {
      return res.status(200).json({
        token: finalized.token,
        expiresIn: finalized.expiresIn,
        deviceId: finalized.deviceId,
        orderId: finalized.orderId,
        status: finalized.status,
      });
    }

    return res.status(200).json({
      orderId: finalized.orderId,
      status: finalized.status,
      deviceId: finalized.deviceId,
    });
  }),
);

export default router;
