import { Router } from "express";
import { requireAuth, AuthRequest } from "../../middlewares/authMiddleware";
import asyncHandler from "../../utils/asyncHandler";
import ApiError from "../../utils/ApiError";
import {
  getUserProfile,
  updateUserProfile,
  getUserFavoritePois,
} from "../../services/userService";
import {
  createPartnerRegistrationRequest,
  getLatestPartnerRegistrationRequestByRequester,
  listPartnerRegistrationRequestsByRequester,
} from "../../services/partnerRegistrationService";
import { synthesizePreviewAudioFromText } from "../../services/ttsService";

const router = Router();

function requireUserId(req: AuthRequest): string {
  const userId = req.user?.sub;
  if (!userId) {
    throw new ApiError(401, "Token rỗng hoặc không hợp lệ.");
  }
  return userId;
}

/**
 * GET /api/v1/users/me
 * @summary Get current user profile
 * @description Retrieve profile information for authenticated user
 * @tags Users
 * @security bearerAuth
 * @return {object} 200 - User profile
 * @return {object} 401 - Unauthorized
 * @return {object} 404 - User not found
 * @return {object} 500 - Internal Server Error
 */
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = requireUserId(req);
    const user = await getUserProfile(userId);
    return res.status(200).json({
      status: "success",
      data: user,
    });
  }),
);

/**
 * PATCH /api/v1/users/me
 * @summary Update current user profile
 * @description Update profile information for authenticated user
 * @tags Users
 * @security bearerAuth
 * @param {object} request.body - Profile update fields
 * @param {string} request.body.fullName - New full name
 * @param {string} request.body.preferredLanguage - Preferred language code
 * @return {object} 200 - Updated profile
 * @return {object} 400 - Invalid payload
 * @return {object} 401 - Unauthorized
 * @return {object} 500 - Internal Server Error
 */
router.patch(
  "/me",
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = requireUserId(req);
    const { fullName, preferredLanguage } = req.body;

    const user = await updateUserProfile(userId, {
      fullName,
      preferredLanguage,
    });
    return res.status(200).json({
      message: "Cập nhật hồ sơ thành công.",
      data: user,
    });
  }),
);

/**
 * GET /api/v1/users/me/favorites
 * @summary Get user's favorite POIs
 * @description Retrieve list of POIs saved by user
 * @tags Users
 * @security bearerAuth
 * @param {number} page.query - Page number (default: 1)
 * @param {number} limit.query - Items per page (default: 20)
 * @return {object} 200 - Favorite POIs list
 * @return {object} 401 - Unauthorized
 * @return {object} 500 - Internal Server Error
 */
router.get(
  "/me/favorites",
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = requireUserId(req);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const data = await getUserFavoritePois(userId, page, limit);
    return res.status(200).json({
      status: "success",
      data,
    });
  }),
);

const handleTtsPreview = asyncHandler(async (req: AuthRequest, res) => {
  requireUserId(req);

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
});

router.post("/me/tts-preview", requireAuth, handleTtsPreview);

router.post("/tts-preview", requireAuth, handleTtsPreview);

router.post(
  "/me/partner-registration-requests",
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = requireUserId(req);
    const shopName =
      typeof req.body?.shopName === "string" ? req.body.shopName : "";
    const shopAddress =
      typeof req.body?.shopAddress === "string" ? req.body.shopAddress : "";
    const note = typeof req.body?.note === "string" ? req.body.note : undefined;

    const item = await createPartnerRegistrationRequest({
      requestedBy: userId,
      shopName,
      shopAddress,
      note,
    });

    return res.status(201).json({
      message: "Đã gửi yêu cầu đăng ký đối tác. Vui lòng chờ ADMIN duyệt.",
      data: item,
    });
  }),
);

router.get(
  "/me/partner-registration-requests",
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = requireUserId(req);
    const items = await listPartnerRegistrationRequestsByRequester(userId);

    return res.status(200).json({
      status: "success",
      data: {
        items,
        total: items.length,
      },
    });
  }),
);

router.get(
  "/me/partner-registration-requests/latest",
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = requireUserId(req);
    const item = await getLatestPartnerRegistrationRequestByRequester(userId);

    return res.status(200).json({
      status: "success",
      data: item,
    });
  }),
);

export default router;
