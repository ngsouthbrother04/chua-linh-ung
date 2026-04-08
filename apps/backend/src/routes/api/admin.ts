import { type RequestHandler, Router } from 'express';
import multer from 'multer';
import asyncHandler from '../../utils/asyncHandler';
import ApiError from '../../utils/ApiError';
import { getCurrentUserRole, isAccessTokenSessionActive, verifyJwt } from '../../services/authService';
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
import { assignAdminUserRole, listAdminUsers, revokeAdminUserRole } from '../../services/adminUserRoleService';

const router = Router();
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.CLOUDINARY_MAX_IMAGE_BYTES ?? 5 * 1024 * 1024)
  }
});

async function assertAdminAccess(req: { headers: Record<string, unknown> }): Promise<{ actorId: string }> {
  const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';

  if (!accessToken) {
    throw new ApiError(403, 'Không có quyền truy cập admin endpoint.');
  }

  const payload = verifyJwt(accessToken) as { sub?: string; role?: string };
  const isActive = await isAccessTokenSessionActive(accessToken);
  if (!isActive || payload.role !== 'ADMIN' || typeof payload.sub !== 'string' || !payload.sub.trim()) {
    throw new ApiError(403, 'Không có quyền truy cập admin endpoint.');
  }

  const actorId = payload.sub.trim();
  const currentRole = await getCurrentUserRole(actorId);
  if (currentRole && currentRole !== 'ADMIN') {
    throw new ApiError(403, 'Không có quyền truy cập admin endpoint.');
  }

  return { actorId };
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

/**
 * POST /api/v1/admin/pois/:id/audio/generate
 * @summary Queue TTS generation for POI
 * @description Enqueue server-side TTS jobs for all available languages of a POI.
 * @tags Admin
 * @security bearerAuth
 * @param {string} id.path.required - POI identifier
 * @return {object} 202 - Queue accepted
 * @return {object} 400 - Missing POI id
 * @return {object} 403 - Forbidden
 * @return {object} 500 - Internal Server Error
 */

router.post(
  '/pois/:id/audio/generate',
  asyncHandler(async (req, res) => {
    await assertAdminAccess(req);

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

/**
 * POST /api/v1/admin/pois/:id/image/upload
 * @summary Upload POI image
 * @description Upload image file for a POI to image storage provider.
 * @tags Admin
 * @security bearerAuth
 * @param {string} id.path.required - POI identifier
 * @param {file} image.formData.required - Image file
 * @return {object} 200 - Upload successful
 * @return {object} 400 - Invalid file or missing input
 * @return {object} 403 - Forbidden
 * @return {object} 500 - Internal Server Error
 */

router.post(
  '/pois/:id/image/upload',
  handleImageUpload,
  asyncHandler(async (req, res) => {
    await assertAdminAccess(req);

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

/**
 * POST /api/v1/admin/tours/:id/image/upload
 * @summary Upload tour image
 * @description Upload image file for a tour to image storage provider.
 * @tags Admin
 * @security bearerAuth
 * @param {string} id.path.required - Tour identifier
 * @param {file} image.formData.required - Image file
 * @return {object} 200 - Upload successful
 * @return {object} 400 - Invalid file or missing input
 * @return {object} 403 - Forbidden
 * @return {object} 500 - Internal Server Error
 */

router.post(
  '/tours/:id/image/upload',
  handleImageUpload,
  asyncHandler(async (req, res) => {
    await assertAdminAccess(req);

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

/**
 * POST /api/v1/admin/pois
 * @summary Create POI
 * @description Create a draft POI record with multilingual payload.
 * @tags Admin
 * @security bearerAuth
 * @param {object} request.body.required - POI create payload
 * @return {object} 201 - POI created
 * @return {object} 400 - Invalid payload
 * @return {object} 403 - Forbidden
 * @return {object} 500 - Internal Server Error
 */

router.post(
  '/pois',
  asyncHandler(async (req, res) => {
    await assertAdminAccess(req);

    const result = await createAdminPoi(req.body ?? {}, getAdminActionContext(req as never));
    return res.status(201).json({
      message: 'Tạo POI thành công.',
      ...result
    });
  })
);

/**
 * POST /api/v1/admin/pois/:id/publish
 * @summary Publish POI content
 * @description Publish POI and enqueue TTS generation.
 * @tags Admin
 * @security bearerAuth
 * @param {string} id.path.required - POI identifier
 * @param {object} request.body - Optional action metadata
 * @param {string} request.body.reason - Publish reason
 * @return {object} 200 - Publish successful
 * @return {object} 400 - Missing POI id
 * @return {object} 403 - Forbidden
 * @return {object} 500 - Internal Server Error
 */

router.post(
  '/pois/:id/publish',
  asyncHandler(async (req, res) => {
    await assertAdminAccess(req);

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

/**
 * GET /api/v1/admin/pois
 * @summary List POIs for admin
 * @description Retrieve POIs including unpublished records for CMS usage.
 * @tags Admin
 * @security bearerAuth
 * @return {object} 200 - POI list
 * @return {object} 403 - Forbidden
 * @return {object} 500 - Internal Server Error
 */

router.get(
  '/pois',
  asyncHandler(async (req, res) => {
    await assertAdminAccess(req);

    const items = await listAdminPois();
    return res.status(200).json({
      items,
      total: items.length
    });
  })
);

/**
 * GET /api/v1/admin/pois/:id
 * @summary Get POI detail for admin
 * @description Retrieve a single POI record including admin-only fields.
 * @tags Admin
 * @security bearerAuth
 * @param {string} id.path.required - POI identifier
 * @return {object} 200 - POI detail
 * @return {object} 400 - Missing POI id
 * @return {object} 403 - Forbidden
 * @return {object} 404 - Not found
 * @return {object} 500 - Internal Server Error
 */

router.get(
  '/pois/:id',
  asyncHandler(async (req, res) => {
    await assertAdminAccess(req);

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

/**
 * PUT /api/v1/admin/pois/:id
 * @summary Update POI
 * @description Update POI fields in draft/admin context.
 * @tags Admin
 * @security bearerAuth
 * @param {string} id.path.required - POI identifier
 * @param {object} request.body.required - POI update payload
 * @return {object} 200 - POI updated
 * @return {object} 400 - Invalid payload or missing id
 * @return {object} 403 - Forbidden
 * @return {object} 404 - Not found
 * @return {object} 500 - Internal Server Error
 */

router.put(
  '/pois/:id',
  asyncHandler(async (req, res) => {
    await assertAdminAccess(req);

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

/**
 * DELETE /api/v1/admin/pois/:id
 * @summary Soft delete POI
 * @description Soft-delete POI and hide from sync outputs.
 * @tags Admin
 * @security bearerAuth
 * @param {string} id.path.required - POI identifier
 * @param {object} request.body - Optional action metadata
 * @param {string} request.body.reason - Delete reason
 * @return {object} 200 - POI deleted
 * @return {object} 400 - Missing POI id
 * @return {object} 403 - Forbidden
 * @return {object} 404 - Not found
 * @return {object} 500 - Internal Server Error
 */

router.delete(
  '/pois/:id',
  asyncHandler(async (req, res) => {
    await assertAdminAccess(req);

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

/**
 * POST /api/v1/admin/tours
 * @summary Create tour
 * @description Create a tour with ordered POI references.
 * @tags Admin
 * @security bearerAuth
 * @param {object} request.body.required - Tour create payload
 * @return {object} 201 - Tour created
 * @return {object} 400 - Invalid payload
 * @return {object} 403 - Forbidden
 * @return {object} 500 - Internal Server Error
 */

router.post(
  '/tours',
  asyncHandler(async (req, res) => {
    await assertAdminAccess(req);

    const result = await createAdminTour(req.body ?? {}, getAdminActionContext(req as never));
    return res.status(201).json({
      message: 'Tạo Tour thành công.',
      ...result
    });
  })
);

/**
 * GET /api/v1/admin/tours/:id
 * @summary Get tour detail for admin
 * @description Retrieve a single tour record including admin fields.
 * @tags Admin
 * @security bearerAuth
 * @param {string} id.path.required - Tour identifier
 * @return {object} 200 - Tour detail
 * @return {object} 400 - Missing tour id
 * @return {object} 403 - Forbidden
 * @return {object} 404 - Not found
 * @return {object} 500 - Internal Server Error
 */

router.get(
  '/tours/:id',
  asyncHandler(async (req, res) => {
    await assertAdminAccess(req);

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

/**
 * PUT /api/v1/admin/tours/:id
 * @summary Update tour
 * @description Update tour metadata and ordered POI references.
 * @tags Admin
 * @security bearerAuth
 * @param {string} id.path.required - Tour identifier
 * @param {object} request.body.required - Tour update payload
 * @return {object} 200 - Tour updated
 * @return {object} 400 - Invalid payload or missing id
 * @return {object} 403 - Forbidden
 * @return {object} 404 - Not found
 * @return {object} 500 - Internal Server Error
 */

router.put(
  '/tours/:id',
  asyncHandler(async (req, res) => {
    await assertAdminAccess(req);

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

/**
 * DELETE /api/v1/admin/tours/:id
 * @summary Soft delete tour
 * @description Soft-delete a tour from admin CMS.
 * @tags Admin
 * @security bearerAuth
 * @param {string} id.path.required - Tour identifier
 * @param {object} request.body - Optional action metadata
 * @param {string} request.body.reason - Delete reason
 * @return {object} 200 - Tour deleted
 * @return {object} 400 - Missing tour id
 * @return {object} 403 - Forbidden
 * @return {object} 404 - Not found
 * @return {object} 500 - Internal Server Error
 */

router.delete(
  '/tours/:id',
  asyncHandler(async (req, res) => {
    await assertAdminAccess(req);

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

/**
 * POST /api/v1/admin/maintenance/pois/soft-delete-cleanup
 * @summary Cleanup retained soft-deleted POIs
 * @description Run dry-run or execute cleanup for expired soft-deleted POI data and media.
 * @tags Admin
 * @security bearerAuth
 * @param {object} request.body - Cleanup payload
 * @param {boolean} request.body.dryRun - Dry-run mode
 * @param {string} request.body.reason - Cleanup reason
 * @return {object} 200 - Cleanup result
 * @return {object} 403 - Forbidden
 * @return {object} 500 - Internal Server Error
 */

router.post(
  '/maintenance/pois/soft-delete-cleanup',
  asyncHandler(async (req, res) => {
    await assertAdminAccess(req);

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

/**
 * POST /api/v1/admin/sync/invalidate
 * @summary Invalidate sync manifest
 * @description Force clients to re-evaluate sync version.
 * @tags Admin
 * @security bearerAuth
 * @return {object} 200 - Manifest invalidated
 * @return {object} 403 - Forbidden
 * @return {object} 500 - Internal Server Error
 */

router.post(
  '/sync/invalidate',
  asyncHandler(async (req, res) => {
    await assertAdminAccess(req);

    const result = await invalidateSyncManifest();
    return res.status(200).json({
      message: 'Đã invalidate sync manifest.',
      ...result
    });
  })
);

/**
 * GET /api/v1/admin/tts/queue/status
 * @summary Get TTS queue status
 * @description Return queue metrics for TTS processing.
 * @tags Admin
 * @security bearerAuth
 * @return {object} 200 - Queue status
 * @return {object} 403 - Forbidden
 * @return {object} 500 - Internal Server Error
 */

router.get(
  '/tts/queue/status',
  asyncHandler(async (req, res) => {
    await assertAdminAccess(req);

    const status = await getTtsQueueStatus();
    return res.status(200).json(status);
  })
);

/**
 * GET /api/v1/admin/tts/config/validate
 * @summary Validate TTS runtime configuration
 * @description Return runtime validation diagnostics for TTS provider setup.
 * @tags Admin
 * @security bearerAuth
 * @return {object} 200 - Configuration valid
 * @return {object} 403 - Forbidden
 * @return {object} 500 - Configuration invalid or internal error
 */

router.get(
  '/tts/config/validate',
  asyncHandler(async (req, res) => {
    await assertAdminAccess(req);

    const validation = validateTtsRuntimeConfig();
    return res.status(validation.ok ? 200 : 500).json(validation);
  })
);

/**
 * GET /api/v1/admin/users
 * @summary List users for admin
 * @description Retrieve users and optionally filter by role.
 * @tags Admin
 * @security bearerAuth
 * @param {string} role.query - USER | PARTNER | ADMIN
 * @return {object} 200 - User list
 * @return {object} 400 - Invalid role filter
 * @return {object} 403 - Forbidden
 * @return {object} 500 - Internal Server Error
 */
router.get(
  '/users',
  asyncHandler(async (req, res) => {
    await assertAdminAccess(req);

    const roleFilter = typeof req.query.role === 'string' ? req.query.role : undefined;
    const items = await listAdminUsers({ role: roleFilter });
    return res.status(200).json({
      items,
      total: items.length
    });
  })
);

/**
 * POST /api/v1/admin/users/:id/role
 * @summary Assign role for a user
 * @description Assign USER/PARTNER/ADMIN role to a target user.
 * @tags Admin
 * @security bearerAuth
 * @param {string} id.path.required - User identifier
 * @param {object} request.body.required - Role update payload
 * @param {string} request.body.role.required - USER | PARTNER | ADMIN
 * @param {string} request.body.reason - Optional reason
 * @return {object} 200 - Role updated
 * @return {object} 400 - Invalid payload
 * @return {object} 403 - Forbidden
 * @return {object} 404 - User not found
 * @return {object} 409 - Guardrail violation
 * @return {object} 500 - Internal Server Error
 */
router.post(
  '/users/:id/role',
  asyncHandler(async (req, res) => {
    const auth = await assertAdminAccess(req);

    const targetUserId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    const nextRole = typeof req.body?.role === 'string' ? req.body.role : '';
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;

    if (!targetUserId) {
      throw new ApiError(400, 'Thiếu user id cần cập nhật role.');
    }

    if (!nextRole) {
      throw new ApiError(400, 'Thiếu role cần cập nhật.');
    }

    const result = await assignAdminUserRole({
      actorId: auth.actorId,
      targetUserId,
      nextRole,
      reason
    });

    return res.status(200).json({
      message: 'Cập nhật role thành công.',
      ...result
    });
  })
);

/**
 * POST /api/v1/admin/users/:id/role/revoke
 * @summary Revoke elevated role
 * @description Revoke target user role down to USER.
 * @tags Admin
 * @security bearerAuth
 * @param {string} id.path.required - User identifier
 * @param {object} request.body - Revoke payload
 * @param {string} request.body.reason - Optional reason
 * @return {object} 200 - Role revoked to USER
 * @return {object} 400 - Invalid input
 * @return {object} 403 - Forbidden
 * @return {object} 404 - User not found
 * @return {object} 409 - Guardrail violation
 * @return {object} 500 - Internal Server Error
 */
router.post(
  '/users/:id/role/revoke',
  asyncHandler(async (req, res) => {
    const auth = await assertAdminAccess(req);

    const targetUserId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;

    if (!targetUserId) {
      throw new ApiError(400, 'Thiếu user id cần thu hồi role.');
    }

    const result = await revokeAdminUserRole({
      actorId: auth.actorId,
      targetUserId,
      reason
    });

    return res.status(200).json({
      message: 'Đã thu hồi role về USER.',
      ...result
    });
  })
);

export default router;
