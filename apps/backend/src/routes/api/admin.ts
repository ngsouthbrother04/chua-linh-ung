import { type RequestHandler, Router } from 'express';
import multer from 'multer';
import asyncHandler from '../../utils/asyncHandler';
import ApiError from '../../utils/ApiError';
import {
  createAdminPoi,
  createAdminTour,
  deleteAdminPoi,
  deleteAdminTour,
  getAdminPoiById,
  getAdminTourById,
  listAdminPois,
  invalidateSyncManifest,
  purgeSoftDeletedPois,
  publishAdminPoi,
  updateAdminPoi,
  updateAdminTour
} from '../../services/poiAdminService';
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

function getAdminActionContext(req: { headers: Record<string, unknown>; body?: unknown }) {
  const actor = typeof req.headers['x-admin-actor'] === 'string' ? req.headers['x-admin-actor'] : undefined;
  const reason =
    typeof (req.body as Record<string, unknown> | undefined)?.reason === 'string'
      ? ((req.body as Record<string, unknown>).reason as string)
      : undefined;

  return {
    actor,
    reason,
    source: 'api'
  };
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

router.post(
  '/pois',
  asyncHandler(async (req, res) => {
    assertAdminAccess(req.headers['x-admin-api-key']);

    const result = await createAdminPoi(req.body ?? {}, getAdminActionContext(req as never));
    return res.status(201).json({
      message: 'Tạo POI thành công.',
      ...result
    });
  })
);

router.post(
  '/pois/:id/publish',
  asyncHandler(async (req, res) => {
    assertAdminAccess(req.headers['x-admin-api-key']);

    const poiId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!poiId) {
      throw new ApiError(400, 'Thiếu POI id.');
    }

    const result = await publishAdminPoi(poiId, getAdminActionContext(req as never));
    const ttsResult = await enqueuePoiTtsGeneration(poiId);

    return res.status(200).json({
      message: 'Publish POI thành công.',
      ...result,
      ttsQueued: ttsResult.queued
    });
  })
);

router.get(
  '/pois',
  asyncHandler(async (req, res) => {
    assertAdminAccess(req.headers['x-admin-api-key']);

    const items = await listAdminPois();
    return res.status(200).json({
      items,
      total: items.length
    });
  })
);

router.get(
  '/pois/:id',
  asyncHandler(async (req, res) => {
    assertAdminAccess(req.headers['x-admin-api-key']);

    const poiId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!poiId) {
      throw new ApiError(400, 'Thiếu POI id.');
    }

    const result = await getAdminPoiById(poiId);
    return res.status(200).json({
      ...result
    });
  })
);

router.put(
  '/pois/:id',
  asyncHandler(async (req, res) => {
    assertAdminAccess(req.headers['x-admin-api-key']);

    const poiId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!poiId) {
      throw new ApiError(400, 'Thiếu POI id.');
    }

    const result = await updateAdminPoi(poiId, req.body ?? {}, getAdminActionContext(req as never));
    return res.status(200).json({
      message: 'Cập nhật POI thành công.',
      ...result
    });
  })
);

router.delete(
  '/pois/:id',
  asyncHandler(async (req, res) => {
    assertAdminAccess(req.headers['x-admin-api-key']);

    const poiId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!poiId) {
      throw new ApiError(400, 'Thiếu POI id.');
    }

    const result = await deleteAdminPoi(poiId, getAdminActionContext(req as never));
    return res.status(200).json({
      message: 'Xóa POI thành công.',
      ...result
    });
  })
);

router.post(
  '/tours',
  asyncHandler(async (req, res) => {
    assertAdminAccess(req.headers['x-admin-api-key']);

    const result = await createAdminTour(req.body ?? {}, getAdminActionContext(req as never));
    return res.status(201).json({
      message: 'Tạo Tour thành công.',
      ...result
    });
  })
);

router.get(
  '/tours/:id',
  asyncHandler(async (req, res) => {
    assertAdminAccess(req.headers['x-admin-api-key']);

    const tourId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!tourId) {
      throw new ApiError(400, 'Thiếu Tour id.');
    }

    const result = await getAdminTourById(tourId);
    return res.status(200).json({
      ...result
    });
  })
);

router.put(
  '/tours/:id',
  asyncHandler(async (req, res) => {
    assertAdminAccess(req.headers['x-admin-api-key']);

    const tourId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!tourId) {
      throw new ApiError(400, 'Thiếu Tour id.');
    }

    const result = await updateAdminTour(tourId, req.body ?? {}, getAdminActionContext(req as never));
    return res.status(200).json({
      message: 'Cập nhật Tour thành công.',
      ...result
    });
  })
);

router.delete(
  '/tours/:id',
  asyncHandler(async (req, res) => {
    assertAdminAccess(req.headers['x-admin-api-key']);

    const tourId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!tourId) {
      throw new ApiError(400, 'Thiếu Tour id.');
    }

    const result = await deleteAdminTour(tourId, getAdminActionContext(req as never));
    return res.status(200).json({
      message: 'Xóa Tour thành công.',
      ...result
    });
  })
);

router.post(
  '/maintenance/pois/soft-delete-cleanup',
  asyncHandler(async (req, res) => {
    assertAdminAccess(req.headers['x-admin-api-key']);

    const dryRun = Boolean((req.body as Record<string, unknown> | undefined)?.dryRun);
    const result = await purgeSoftDeletedPois({
      dryRun,
      context: getAdminActionContext(req as never)
    });

    return res.status(200).json({
      message: dryRun ? 'Đã chạy dry-run cleanup soft-delete.' : 'Đã chạy cleanup soft-delete.',
      ...result
    });
  })
);

router.post(
  '/sync/invalidate',
  asyncHandler(async (req, res) => {
    assertAdminAccess(req.headers['x-admin-api-key']);

    const result = await invalidateSyncManifest();
    return res.status(200).json({
      message: 'Đã invalidate sync manifest.',
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
