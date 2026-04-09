import { type RequestHandler, Router } from 'express';
import multer from 'multer';
import asyncHandler from '../../utils/asyncHandler';
import ApiError from '../../utils/ApiError';
import { getCurrentUserRole, isAccessTokenSessionActive, verifyJwt } from '../../services/authService';
import { uploadPoiImage, uploadTourImage } from '../../services/imageService';
import { getAdminPoiById, getAdminTourById } from '../../services/poiAdminService';
import {
  createPartnerApprovalRequest,
  getApprovalRequestByIdForRequester,
  listApprovalRequestsByRequester
} from '../../services/partnerApprovalService';

const router = Router();
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.CLOUDINARY_MAX_IMAGE_BYTES ?? 5 * 1024 * 1024)
  }
});

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

async function assertPartnerAccess(req: { headers: Record<string, unknown> }): Promise<{ actorId: string }> {
  const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';

  if (!accessToken) {
    throw new ApiError(403, 'Không có quyền truy cập partner endpoint.');
  }

  const payload = verifyJwt(accessToken) as { sub?: string; role?: string };
  const isActive = await isAccessTokenSessionActive(accessToken);
  if (!isActive || typeof payload.sub !== 'string' || !payload.sub.trim()) {
    throw new ApiError(403, 'Phiên đăng nhập không hợp lệ.');
  }

  const actorId = payload.sub.trim();
  const currentRole = await getCurrentUserRole(actorId);
  if (currentRole !== 'PARTNER') {
    throw new ApiError(403, 'Chỉ PARTNER mới được sử dụng endpoint này.');
  }

  return { actorId };
}

function extractCrudPayload(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ApiError(400, 'payload phải là object JSON hợp lệ.');
  }

  return body as Record<string, unknown>;
}

router.post(
  '/pois/:id/image/upload',
  handleImageUpload,
  asyncHandler(async (req, res) => {
    const auth = await assertPartnerAccess(req);
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

    await getAdminPoiById(poiId, { actorId: auth.actorId, role: 'PARTNER' });
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
    const auth = await assertPartnerAccess(req);
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

    await getAdminTourById(tourId, { actorId: auth.actorId, role: 'PARTNER' });
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
    const auth = await assertPartnerAccess(req);
    const requestItem = await createPartnerApprovalRequest({
      entityType: 'POI',
      actionType: 'CREATE',
      payload: extractCrudPayload(req.body),
      requestedBy: auth.actorId,
      reason: typeof req.body?.reason === 'string' ? req.body.reason : undefined
    });

    return res.status(201).json({
      message: 'Đã gửi request tạo POI chờ ADMIN duyệt.',
      ...requestItem
    });
  })
);

router.put(
  '/pois/:id',
  asyncHandler(async (req, res) => {
    const auth = await assertPartnerAccess(req);
    const poiId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!poiId) {
      throw new ApiError(400, 'Thiếu POI id.');
    }

    const requestItem = await createPartnerApprovalRequest({
      entityType: 'POI',
      actionType: 'UPDATE',
      targetId: poiId,
      payload: extractCrudPayload(req.body),
      requestedBy: auth.actorId,
      reason: typeof req.body?.reason === 'string' ? req.body.reason : undefined
    });

    return res.status(201).json({
      message: 'Đã gửi request cập nhật POI chờ ADMIN duyệt.',
      ...requestItem
    });
  })
);

router.delete(
  '/pois/:id',
  asyncHandler(async (req, res) => {
    const auth = await assertPartnerAccess(req);
    const poiId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!poiId) {
      throw new ApiError(400, 'Thiếu POI id.');
    }

    const requestItem = await createPartnerApprovalRequest({
      entityType: 'POI',
      actionType: 'DELETE',
      targetId: poiId,
      requestedBy: auth.actorId,
      reason: typeof req.body?.reason === 'string' ? req.body.reason : undefined
    });

    return res.status(201).json({
      message: 'Đã gửi request xoá POI chờ ADMIN duyệt.',
      ...requestItem
    });
  })
);

router.post(
  '/tours',
  asyncHandler(async (req, res) => {
    const auth = await assertPartnerAccess(req);
    const requestItem = await createPartnerApprovalRequest({
      entityType: 'TOUR',
      actionType: 'CREATE',
      payload: extractCrudPayload(req.body),
      requestedBy: auth.actorId,
      reason: typeof req.body?.reason === 'string' ? req.body.reason : undefined
    });

    return res.status(201).json({
      message: 'Đã gửi request tạo Tour chờ ADMIN duyệt.',
      ...requestItem
    });
  })
);

router.put(
  '/tours/:id',
  asyncHandler(async (req, res) => {
    const auth = await assertPartnerAccess(req);
    const tourId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!tourId) {
      throw new ApiError(400, 'Thiếu Tour id.');
    }

    const requestItem = await createPartnerApprovalRequest({
      entityType: 'TOUR',
      actionType: 'UPDATE',
      targetId: tourId,
      payload: extractCrudPayload(req.body),
      requestedBy: auth.actorId,
      reason: typeof req.body?.reason === 'string' ? req.body.reason : undefined
    });

    return res.status(201).json({
      message: 'Đã gửi request cập nhật Tour chờ ADMIN duyệt.',
      ...requestItem
    });
  })
);

router.delete(
  '/tours/:id',
  asyncHandler(async (req, res) => {
    const auth = await assertPartnerAccess(req);
    const tourId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!tourId) {
      throw new ApiError(400, 'Thiếu Tour id.');
    }

    const requestItem = await createPartnerApprovalRequest({
      entityType: 'TOUR',
      actionType: 'DELETE',
      targetId: tourId,
      requestedBy: auth.actorId,
      reason: typeof req.body?.reason === 'string' ? req.body.reason : undefined
    });

    return res.status(201).json({
      message: 'Đã gửi request xoá Tour chờ ADMIN duyệt.',
      ...requestItem
    });
  })
);

router.get(
  '/approval-requests/mine',
  asyncHandler(async (req, res) => {
    const auth = await assertPartnerAccess(req);
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const entityType = typeof req.query.entityType === 'string' ? req.query.entityType : undefined;
    const actionType = typeof req.query.actionType === 'string' ? req.query.actionType : undefined;

    const items = await listApprovalRequestsByRequester({
      requestedBy: auth.actorId,
      status,
      entityType,
      actionType
    });

    return res.status(200).json({
      items,
      total: items.length
    });
  })
);

router.get(
  '/approval-requests/mine/:id',
  asyncHandler(async (req, res) => {
    const auth = await assertPartnerAccess(req);
    const requestId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!requestId) {
      throw new ApiError(400, 'Thiếu approval request id.');
    }

    const item = await getApprovalRequestByIdForRequester({
      requestId,
      requestedBy: auth.actorId
    });

    return res.status(200).json(item);
  })
);

export default router;
