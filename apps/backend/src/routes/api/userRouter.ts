import { Router } from "express";
import { userController } from "../../controllers/userController";
import { requireAuth } from "../../middlewares/authMiddleware"; // Dùng đúng tên hàm bạn vừa gửi
import asyncHandler from "../../utils/asyncHandler";
import ApiError from "../../utils/ApiError";
import { synthesizePreviewAudioFromText } from "../../services/ttsService";

const router = Router();

// PATCH /api/v1/users/profile
router.patch("/profile", requireAuth, userController.updateProfile);

// POST /api/v1/users/change-password
router.post("/change-password", requireAuth, userController.changePassword);
// Thêm route lấy thông tin cá nhân (GET)
router.get("/profile", requireAuth, userController.getProfile);

router.post(
  "/tts-preview",
  requireAuth,
  asyncHandler(async (req, res) => {
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

      if (message.startsWith("GOOGLE_TTS_") || message.startsWith("TTS_")) {
        throw new ApiError(500, "Google TTS runtime lỗi khi sinh audio.");
      }

      throw new ApiError(500, "Không thể tạo audio test từ mô tả.");
    }
  }),
);

export default router;
