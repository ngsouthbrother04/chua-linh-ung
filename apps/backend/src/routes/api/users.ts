import { Router } from "express";
import { requireAuth, AuthRequest } from "../../middlewares/authMiddleware";
import asyncHandler from "../../utils/asyncHandler";
import ApiError from "../../utils/ApiError";
import {
  getUserProfile,
  updateUserProfile,
  getUserFavoritePois,
} from "../../services/userService";
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
    typeof req.body?.language === "string" ? req.body.language : "vi";

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

    if (message === "PIPER_MODEL_NOT_CONFIGURED") {
      throw new ApiError(500, "TTS chưa được cấu hình model giọng đọc.");
    }

    if (message === "PIPER_MODEL_FILE_NOT_FOUND") {
      throw new ApiError(
        500,
        "Không tìm thấy file model Piper cho ngôn ngữ đã chọn.",
      );
    }

    if (message === "PIPER_BIN_NOT_FOUND") {
      throw new ApiError(
        500,
        "Không tìm thấy chương trình piper. Hãy cài Piper hoặc cấu hình PIPER_BIN đúng đường dẫn.",
      );
    }

    if (
      message.startsWith("PIPER_PROCESS_EXIT_") ||
      message.startsWith("PIPER_EXECUTION_FAILED")
    ) {
      throw new ApiError(500, "TTS runtime lỗi khi sinh audio.");
    }

    throw new ApiError(500, "Không thể tạo audio test từ mô tả.");
  }
});

router.post("/me/tts-preview", requireAuth, handleTtsPreview);

router.post("/tts-preview", requireAuth, handleTtsPreview);

export default router;
