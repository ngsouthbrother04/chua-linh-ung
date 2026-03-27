import { type RequestHandler, Router } from 'express';
import multer from 'multer';
import asyncHandler from '../../utils/asyncHandler';
import ApiError from '../../utils/ApiError';
import { enqueuePoiTtsGeneration, getTtsQueueStatus, validateTtsRuntimeConfig } from '../../services/ttsService';
import { uploadPoiImage, uploadTourImage } from '../../services/imageService';

const router = Router();
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.CLOUDINARY_MAX_IMAGE_BYTES ?? 5 * 1024 * 1024)
  }
});

function assertAdminAccess(headerValue: unknown): void {
  const requiredAdminToken = process.env.ADMIN_API_KEY;
  if (!requiredAdminToken) {
    return;
  }

  const providedToken = typeof headerValue === 'string' ? headerValue : '';
  if (providedToken !== requiredAdminToken) {
    throw new ApiError(403, 'Không có quyền truy cập admin endpoint.');
  }
}

const handleImageUpload: RequestHandler = (req, res, next) => {
  imageUpload.single('image')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        next(new ApiError(400, 'Kich thuoc anh vuot qua gioi han cho phep.'));
        return;
      }

      next(new ApiError(400, 'Upload anh khong hop le.'));
      return;
    }

    next(err);
  });
};

router.post(
  '/pois/:id/audio/generate',
  asyncHandler(async (req, res) => {
    assertAdminAccess(req.headers['x-admin-api-key']);

    const poiId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!poiId) {
      throw new ApiError(400, 'Thiếu POI id cần generate audio.');
    }

    const result = await enqueuePoiTtsGeneration(poiId);
    return res.status(202).json({
      message: 'Đã đưa tác vụ TTS vào queue.',
      ...result
    });
  })
);

router.post(
  '/pois/:id/image/upload',
  handleImageUpload,
  asyncHandler(async (req, res) => {
    assertAdminAccess(req.headers['x-admin-api-key']);

    const poiId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!poiId) {
      throw new ApiError(400, 'Thiếu POI id cần upload ảnh.');
    }

    if (!req.file) {
      throw new ApiError(400, 'Thiếu file ảnh với field image.');
    }

    if (!req.file.mimetype.startsWith('image/')) {
      throw new ApiError(400, 'Chi chap nhan file anh hop le.');
    }

    const result = await uploadPoiImage(poiId, req.file);
    return res.status(200).json({
      message: 'Upload ảnh thành công.',
      ...result
    });
  })
);

router.post(
  '/tours/:id/image/upload',
  handleImageUpload,
  asyncHandler(async (req, res) => {
    assertAdminAccess(req.headers['x-admin-api-key']);

    const tourId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!tourId) {
      throw new ApiError(400, 'Thiếu Tour id cần upload ảnh.');
    }

    if (!req.file) {
      throw new ApiError(400, 'Thiếu file ảnh với field image.');
    }

    if (!req.file.mimetype.startsWith('image/')) {
      throw new ApiError(400, 'Chi chap nhan file anh hop le.');
    }

    const result = await uploadTourImage(tourId, req.file);
    return res.status(200).json({
      message: 'Upload ảnh thành công.',
      ...result
    });
  })
);

router.get(
  '/tts/queue/status',
  asyncHandler(async (req, res) => {
    assertAdminAccess(req.headers['x-admin-api-key']);

    const status = await getTtsQueueStatus();
    return res.status(200).json(status);
  })
);

router.get(
  '/tts/config/validate',
  asyncHandler(async (req, res) => {
    assertAdminAccess(req.headers['x-admin-api-key']);

    const validation = validateTtsRuntimeConfig();
    return res.status(validation.ok ? 200 : 500).json(validation);
  })
);

export default router;
