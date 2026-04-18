import { Router } from "express";
import multer from "multer";
import asyncHandler from "../../utils/asyncHandler";
import ApiError from "../../utils/ApiError";
import {
  getCurrentUserRole,
  isAccessTokenSessionActive,
  verifyJwt,
} from "../../services/authService";
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
  unpublishAdminPoi,
  updateAdminPoi,
  updateAdminTour,
} from "../../services/poiAdminService";
import { uploadPoiImage } from "../../services/imageService";
import {
  getPartnerRegistrationRequestById,
  listPartnerRegistrationRequests,
  reviewPartnerRegistrationRequest,
} from "../../services/partnerRegistrationService";
import {
  enqueuePoiTtsGeneration,
  getTtsQueueStatus,
  validateTtsRuntimeConfig,
} from "../../services/ttsService";
import {
  assignAdminUserRole,
  listAdminUsers,
  revokeAdminUserRole,
  setAdminUserAccessStatus,
} from "../../services/adminUserRoleService";
import {
  createPaymentPackage,
  deletePaymentPackage,
  listPaymentPackages,
  updatePaymentPackage,
} from "../../services/paymentPackageService";

const router = Router();
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.CLOUDINARY_MAX_IMAGE_BYTES ?? 5 * 1024 * 1024),
  },
});

function handleImageUpload(req: any, res: any, next: any) {
  imageUpload.single("image")(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        next(new ApiError(400, "Kich thuoc anh vuot qua gioi han cho phep."));
        return;
      }

      next(new ApiError(400, "Upload anh khong hop le."));
      return;
    }

    next(err as any);
  });
}

async function assertAdminAccess(req: {
  headers: Record<string, unknown>;
}): Promise<{ actorId: string }> {
  const authHeader =
    typeof req.headers.authorization === "string"
      ? req.headers.authorization
      : "";
  const accessToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!accessToken) {
    throw new ApiError(403, "Không có quyền truy cập admin endpoint.");
  }

  const payload = verifyJwt(accessToken) as { sub?: string; role?: string };
  const isActive = await isAccessTokenSessionActive(accessToken);
  if (
    !isActive ||
    payload.role !== "ADMIN" ||
    typeof payload.sub !== "string" ||
    !payload.sub.trim()
  ) {
    throw new ApiError(403, "Không có quyền truy cập admin endpoint.");
  }

  const actorId = payload.sub.trim();
  const currentRole = await getCurrentUserRole(actorId);
  if (currentRole && currentRole !== "ADMIN") {
    throw new ApiError(403, "Không có quyền truy cập admin endpoint.");
  }

  return { actorId };
}

async function assertElevatedAccess(
  req: { headers: Record<string, unknown> },
  allowedRoles: string[] = ["ADMIN", "PARTNER"],
): Promise<{ actorId: string; role: string }> {
  const authHeader =
    typeof req.headers.authorization === "string"
      ? req.headers.authorization
      : "";
  const accessToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!accessToken) {
    throw new ApiError(403, "Không có quyền truy cập endpoint.");
  }

  const payload = verifyJwt(accessToken) as { sub?: string; role?: string };
  const isActive = await isAccessTokenSessionActive(accessToken);
  if (!isActive || typeof payload.sub !== "string" || !payload.sub.trim()) {
    throw new ApiError(403, "Phiên đăng nhập không hợp lệ.");
  }

  const actorId = payload.sub.trim();
  const currentRole = await getCurrentUserRole(actorId);

  if (!currentRole || !allowedRoles.includes(currentRole)) {
    throw new ApiError(403, "Không quyền truy cập endpoint.");
  }

  return { actorId, role: currentRole };
}

function getAdminActionContext(req: {
  headers: Record<string, unknown>;
  body?: unknown;
}) {
  const actor =
    typeof req.headers["x-admin-actor"] === "string"
      ? req.headers["x-admin-actor"]
      : undefined;
  const reason =
    typeof (req.body as Record<string, unknown> | undefined)?.reason ===
    "string"
      ? ((req.body as Record<string, unknown>).reason as string)
      : undefined;

  return {
    actor,
    reason,
    source: "api",
  };
}

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
  "/pois/:id/audio/generate",
  asyncHandler(async (req, res) => {
    await assertAdminAccess(req);

    const poiId = typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!poiId) {
      throw new ApiError(400, "Thiếu POI id cần generate audio.");
    }

    const result = await enqueuePoiTtsGeneration(poiId);
    return res.status(202).json({
      message: "Đã đưa tác vụ TTS vào queue.",
      ...result,
    });
  }),
);

/**
 * POST /api/v1/admin/pois
 * @summary Submit POI create request
 * @description PARTNER submits a POI create payload for ADMIN review.
 * @tags Admin
 * @security bearerAuth
 * @param {object} request.body.required - POI create payload
 * @return {object} 201 - POI created
 * @return {object} 400 - Invalid payload
 * @return {object} 403 - Forbidden
 * @return {object} 500 - Internal Server Error
 */

router.post(
  "/pois",
  asyncHandler(async (req, res) => {
    const auth = await assertElevatedAccess(req, ["PARTNER", "ADMIN"]);
    const reason =
      typeof req.body?.reason === "string" ? req.body.reason : undefined;
    const result = await createAdminPoi(
      {
        ...(req.body ?? {}),
        creatorId: auth.actorId,
      } as any,
      {
        actor: auth.actorId,
        reason,
        source: "admin-api",
      },
    );

    return res.status(201).json({
      message: "Tạo POI thành công.",
      data: result,
    });
  }),
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
  "/pois/:id/publish",
  asyncHandler(async (req, res) => {
    await assertAdminAccess(req);

    const poiId = typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!poiId) {
      throw new ApiError(400, "Thiếu POI id.");
    }

    const result = await publishAdminPoi(
      poiId,
      getAdminActionContext(req as never),
    );
    const ttsResult = await enqueuePoiTtsGeneration(poiId);

    return res.status(200).json({
      message: "Publish POI thành công.",
      ...result,
      ttsQueued: ttsResult.queued,
    });
  }),
);

router.post(
  "/pois/:id/unpublish",
  asyncHandler(async (req, res) => {
    await assertAdminAccess(req);

    const poiId = typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!poiId) {
      throw new ApiError(400, "Thiếu POI id.");
    }

    const result = await unpublishAdminPoi(
      poiId,
      getAdminActionContext(req as never),
    );

    return res.status(200).json({
      message: "Unpublish POI thành công.",
      ...result,
    });
  }),
);

router.post(
  "/pois/:id/image/upload",
  handleImageUpload,
  asyncHandler(async (req, res) => {
    const auth = await assertAdminAccess(req);

    const poiId = typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!poiId) {
      throw new ApiError(400, "Thiếu POI id cần upload ảnh.");
    }

    if (!req.file) {
      throw new ApiError(400, "Thiếu file ảnh với field image.");
    }

    if (!req.file.mimetype.startsWith("image/")) {
      throw new ApiError(400, "Chi chap nhan file anh hop le.");
    }

    await getAdminPoiById(poiId, { actorId: auth.actorId, role: "ADMIN" });
    const result = await uploadPoiImage(poiId, req.file);

    return res.status(200).json({
      message: "Upload ảnh thành công.",
      ...result,
    });
  }),
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
  "/pois",
  asyncHandler(async (req, res) => {
    const auth = await assertElevatedAccess(req, ["ADMIN", "PARTNER"]);

    const items = await listAdminPois(auth);
    return res.status(200).json({
      items,
      total: items.length,
    });
  }),
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
  "/pois/:id",
  asyncHandler(async (req, res) => {
    const auth = await assertElevatedAccess(req, ["ADMIN", "PARTNER"]);

    const poiId = typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!poiId) {
      throw new ApiError(400, "Thiếu POI id.");
    }

    const result = await getAdminPoiById(poiId, auth);
    return res.status(200).json({
      ...result,
    });
  }),
);

/**
 * PUT /api/v1/admin/pois/:id
 * @summary Submit POI update request
 * @description PARTNER submits a POI update payload for ADMIN review.
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
  "/pois/:id",
  asyncHandler(async (req, res) => {
    const auth = await assertElevatedAccess(req, ["PARTNER", "ADMIN"]);

    const poiId = typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!poiId) {
      throw new ApiError(400, "Thiếu POI id.");
    }

    const reason =
      typeof req.body?.reason === "string" ? req.body.reason : undefined;
    const result = await updateAdminPoi(poiId, req.body ?? {}, auth, {
      actor: auth.actorId,
      reason,
      source: "admin-api",
    });

    return res.status(200).json({
      message: "Cập nhật POI thành công.",
      data: result,
    });
  }),
);

/**
 * DELETE /api/v1/admin/pois/:id
 * @summary Submit POI delete request
 * @description PARTNER submits a POI delete request for ADMIN review.
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
  "/pois/:id",
  asyncHandler(async (req, res) => {
    const auth = await assertElevatedAccess(req, ["PARTNER", "ADMIN"]);

    const poiId = typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!poiId) {
      throw new ApiError(400, "Thiếu POI id.");
    }

    const reason =
      typeof req.body?.reason === "string" ? req.body.reason : undefined;
    const result = await deleteAdminPoi(poiId, auth, {
      actor: auth.actorId,
      reason,
      source: "admin-api",
    });

    return res.status(200).json({
      message: "Xóa POI thành công.",
      data: result,
    });
  }),
);

/**
 * POST /api/v1/admin/tours
 * @summary Submit Tour create request
 * @description PARTNER submits a Tour create payload for ADMIN review.
 * @tags Admin
 * @security bearerAuth
 * @param {object} request.body.required - Tour create payload
 * @return {object} 201 - Tour created
 * @return {object} 400 - Invalid payload
 * @return {object} 403 - Forbidden
 * @return {object} 500 - Internal Server Error
 */

router.post(
  "/tours",
  asyncHandler(async (req, res) => {
    const auth = await assertElevatedAccess(req, ["PARTNER", "ADMIN"]);
    const reason =
      typeof req.body?.reason === "string" ? req.body.reason : undefined;
    const result = await createAdminTour(
      {
        ...(req.body ?? {}),
        creatorId: auth.actorId,
      } as any,
      {
        actor: auth.actorId,
        reason,
        source: "admin-api",
      },
    );

    return res.status(201).json({
      message: "Tạo Tour thành công.",
      data: result,
    });
  }),
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
  "/tours/:id",
  asyncHandler(async (req, res) => {
    const auth = await assertElevatedAccess(req, ["ADMIN", "PARTNER"]);

    const tourId =
      typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!tourId) {
      throw new ApiError(400, "Thiếu Tour id.");
    }

    const result = await getAdminTourById(tourId, auth);
    return res.status(200).json({
      ...result,
    });
  }),
);

/**
 * PUT /api/v1/admin/tours/:id
 * @summary Submit Tour update request
 * @description PARTNER submits a Tour update payload for ADMIN review.
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
  "/tours/:id",
  asyncHandler(async (req, res) => {
    const auth = await assertElevatedAccess(req, ["PARTNER", "ADMIN"]);

    const tourId =
      typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!tourId) {
      throw new ApiError(400, "Thiếu Tour id.");
    }

    const reason =
      typeof req.body?.reason === "string" ? req.body.reason : undefined;
    const result = await updateAdminTour(tourId, req.body ?? {}, auth, {
      actor: auth.actorId,
      reason,
      source: "admin-api",
    });

    return res.status(200).json({
      message: "Cập nhật Tour thành công.",
      data: result,
    });
  }),
);

/**
 * DELETE /api/v1/admin/tours/:id
 * @summary Submit Tour delete request
 * @description PARTNER submits a Tour delete request for ADMIN review.
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
  "/tours/:id",
  asyncHandler(async (req, res) => {
    const auth = await assertElevatedAccess(req, ["PARTNER", "ADMIN"]);

    const tourId =
      typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!tourId) {
      throw new ApiError(400, "Thiếu Tour id.");
    }

    const reason =
      typeof req.body?.reason === "string" ? req.body.reason : undefined;
    const result = await deleteAdminTour(tourId, auth, {
      actor: auth.actorId,
      reason,
      source: "admin-api",
    });

    return res.status(200).json({
      message: "Xóa Tour thành công.",
      data: result,
    });
  }),
);

router.get(
  "/partner-registration-requests",
  asyncHandler(async (req, res) => {
    await assertAdminAccess(req);

    const status =
      typeof req.query.status === "string" ? req.query.status : undefined;
    const items = await listPartnerRegistrationRequests({ status });

    return res.status(200).json({
      items,
      total: items.length,
    });
  }),
);

router.get(
  "/partner-registration-requests/:id",
  asyncHandler(async (req, res) => {
    await assertAdminAccess(req);

    const requestId =
      typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!requestId) {
      throw new ApiError(400, "Thiếu partner registration request id.");
    }

    const item = await getPartnerRegistrationRequestById(requestId);
    return res.status(200).json(item);
  }),
);

router.post(
  "/partner-registration-requests/:id/approve",
  asyncHandler(async (req, res) => {
    const auth = await assertAdminAccess(req);

    const requestId =
      typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!requestId) {
      throw new ApiError(400, "Thiếu partner registration request id.");
    }

    const decisionNote =
      typeof req.body?.decisionNote === "string"
        ? req.body.decisionNote
        : undefined;
    const requestItem = await getPartnerRegistrationRequestById(requestId);
    if (requestItem.status !== "PENDING") {
      throw new ApiError(409, "Yêu cầu đã được xử lý trước đó.");
    }

    await assignAdminUserRole({
      actorId: auth.actorId,
      targetUserId: requestItem.requestedBy,
      nextRole: "PARTNER",
      reason: decisionNote,
    });

    const item = await reviewPartnerRegistrationRequest({
      requestId,
      reviewerId: auth.actorId,
      action: "APPROVE",
      decisionNote,
    });

    return res.status(200).json({
      message: "Đã duyệt đăng ký đối tác và cấp quyền PARTNER.",
      ...item,
    });
  }),
);

router.post(
  "/partner-registration-requests/:id/reject",
  asyncHandler(async (req, res) => {
    const auth = await assertAdminAccess(req);

    const requestId =
      typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!requestId) {
      throw new ApiError(400, "Thiếu partner registration request id.");
    }

    const decisionNote =
      typeof req.body?.decisionNote === "string"
        ? req.body.decisionNote
        : undefined;
    const item = await reviewPartnerRegistrationRequest({
      requestId,
      reviewerId: auth.actorId,
      action: "REJECT",
      decisionNote,
    });

    return res.status(200).json({
      message: "Đã từ chối yêu cầu đăng ký đối tác.",
      ...item,
    });
  }),
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
  "/maintenance/pois/soft-delete-cleanup",
  asyncHandler(async (req, res) => {
    await assertAdminAccess(req);

    const dryRun = Boolean(
      (req.body as Record<string, unknown> | undefined)?.dryRun,
    );
    const result = await purgeSoftDeletedPois({
      dryRun,
      context: getAdminActionContext(req as never),
    });

    return res.status(200).json({
      message: dryRun
        ? "Đã chạy dry-run cleanup soft-delete."
        : "Đã chạy cleanup soft-delete.",
      ...result,
    });
  }),
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
  "/sync/invalidate",
  asyncHandler(async (req, res) => {
    await assertAdminAccess(req);

    const result = await invalidateSyncManifest();
    return res.status(200).json({
      message: "Đã invalidate sync manifest.",
      ...result,
    });
  }),
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
  "/tts/queue/status",
  asyncHandler(async (req, res) => {
    await assertAdminAccess(req);

    const status = await getTtsQueueStatus();
    return res.status(200).json(status);
  }),
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
  "/tts/config/validate",
  asyncHandler(async (req, res) => {
    await assertAdminAccess(req);

    const validation = validateTtsRuntimeConfig();
    return res.status(validation.ok ? 200 : 500).json(validation);
  }),
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
  "/users",
  asyncHandler(async (req, res) => {
    await assertAdminAccess(req);

    const roleFilter =
      typeof req.query.role === "string" ? req.query.role : undefined;
    const items = await listAdminUsers({ role: roleFilter });
    return res.status(200).json({
      items,
      total: items.length,
    });
  }),
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
  "/users/:id/role",
  asyncHandler(async (req, res) => {
    const auth = await assertAdminAccess(req);

    const targetUserId =
      typeof req.params.id === "string" ? req.params.id.trim() : "";
    const nextRole = typeof req.body?.role === "string" ? req.body.role : "";
    const reason =
      typeof req.body?.reason === "string" ? req.body.reason : undefined;

    if (!targetUserId) {
      throw new ApiError(400, "Thiếu user id cần cập nhật role.");
    }

    if (!nextRole) {
      throw new ApiError(400, "Thiếu role cần cập nhật.");
    }

    const result = await assignAdminUserRole({
      actorId: auth.actorId,
      targetUserId,
      nextRole,
      reason,
    });

    return res.status(200).json({
      message: "Cập nhật role thành công.",
      ...result,
    });
  }),
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
  "/users/:id/role/revoke",
  asyncHandler(async (req, res) => {
    const auth = await assertAdminAccess(req);

    const targetUserId =
      typeof req.params.id === "string" ? req.params.id.trim() : "";
    const reason =
      typeof req.body?.reason === "string" ? req.body.reason : undefined;

    if (!targetUserId) {
      throw new ApiError(400, "Thiếu user id cần thu hồi role.");
    }

    const result = await revokeAdminUserRole({
      actorId: auth.actorId,
      targetUserId,
      reason,
    });

    return res.status(200).json({
      message: "Đã thu hồi role về USER.",
      ...result,
    });
  }),
);

/**
 * POST /api/v1/admin/users/:id/lock
 * @summary Lock a user account
 * @description Lock target user by setting isActive=false. Cannot lock ADMIN role.
 * @tags Admin
 * @security bearerAuth
 * @param {string} id.path.required - User identifier
 * @param {object} request.body - Lock payload
 * @param {string} request.body.reason - Optional reason
 * @return {object} 200 - User account locked
 * @return {object} 400 - Invalid input
 * @return {object} 403 - Forbidden
 * @return {object} 404 - User not found
 * @return {object} 409 - Guardrail violation
 * @return {object} 500 - Internal Server Error
 */
router.post(
  "/users/:id/lock",
  asyncHandler(async (req, res) => {
    const auth = await assertAdminAccess(req);

    const targetUserId =
      typeof req.params.id === "string" ? req.params.id.trim() : "";
    const reason =
      typeof req.body?.reason === "string" ? req.body.reason : undefined;

    if (!targetUserId) {
      throw new ApiError(400, "Thiếu user id cần khóa tài khoản.");
    }

    const result = await setAdminUserAccessStatus({
      actorId: auth.actorId,
      targetUserId,
      isActive: false,
      reason,
    });

    return res.status(200).json({
      message: "Đã khóa tài khoản người dùng.",
      ...result,
    });
  }),
);

/**
 * POST /api/v1/admin/users/:id/unlock
 * @summary Unlock a user account
 * @description Unlock target user by setting isActive=true.
 * @tags Admin
 * @security bearerAuth
 * @param {string} id.path.required - User identifier
 * @param {object} request.body - Unlock payload
 * @param {string} request.body.reason - Optional reason
 * @return {object} 200 - User account unlocked
 * @return {object} 400 - Invalid input
 * @return {object} 403 - Forbidden
 * @return {object} 404 - User not found
 * @return {object} 500 - Internal Server Error
 */
router.post(
  "/users/:id/unlock",
  asyncHandler(async (req, res) => {
    const auth = await assertAdminAccess(req);

    const targetUserId =
      typeof req.params.id === "string" ? req.params.id.trim() : "";
    const reason =
      typeof req.body?.reason === "string" ? req.body.reason : undefined;

    if (!targetUserId) {
      throw new ApiError(400, "Thiếu user id cần mở khóa tài khoản.");
    }

    const result = await setAdminUserAccessStatus({
      actorId: auth.actorId,
      targetUserId,
      isActive: true,
      reason,
    });

    return res.status(200).json({
      message: "Đã mở khóa tài khoản người dùng.",
      ...result,
    });
  }),
);

/**
 * GET /api/v1/admin/payment-packages
 * @summary List payment packages
 * @description Return payment package prices configured by admin.
 * @tags Admin
 * @security bearerAuth
 * @param {boolean} includeInactive.query - Include inactive packages
 * @return {object} 200 - Package list
 * @return {object} 403 - Forbidden
 * @return {object} 500 - Internal Server Error
 */
router.get(
  "/payment-packages",
  asyncHandler(async (req, res) => {
    await assertAdminAccess(req);

    const includeInactiveRaw =
      typeof req.query.includeInactive === "string"
        ? req.query.includeInactive.toLowerCase()
        : "";
    const includeInactive =
      includeInactiveRaw === "1" || includeInactiveRaw === "true";

    const items = await listPaymentPackages({ includeInactive });
    return res.status(200).json({
      items,
      total: items.length,
    });
  }),
);

/**
 * POST /api/v1/admin/payment-packages
 * @summary Create payment package
 * @description Create a new payment package and package price.
 * @tags Admin
 * @security bearerAuth
 * @param {object} request.body.required - Package payload
 * @param {string} request.body.name.required - Package display name
 * @param {number} request.body.amount.required - Package price
 * @param {string} request.body.currency - Currency code (default VND)
 * @param {number} request.body.durationDays - Package validity in days (default 30)
 * @param {number} request.body.poiQuota.required - Maximum POIs allowed
 * @param {string} request.body.description - Package description
 * @param {boolean} request.body.isActive - Package activation state (default true)
 * @return {object} 201 - Package created
 * @return {object} 400 - Invalid payload
 * @return {object} 403 - Forbidden
 * @return {object} 409 - Package code already exists
 * @return {object} 500 - Internal Server Error
 */
router.post(
  "/payment-packages",
  asyncHandler(async (req, res) => {
    const auth = await assertAdminAccess(req);

    const created = await createPaymentPackage({
      name: typeof req.body?.name === "string" ? req.body.name : "",
      amount: Number(req.body?.amount),
      currency:
        typeof req.body?.currency === "string" ? req.body.currency : undefined,
      durationDays:
        req.body?.durationDays === undefined
          ? undefined
          : Number(req.body.durationDays),
      poiQuota: Number(req.body?.poiQuota),
      description:
        typeof req.body?.description === "string"
          ? req.body.description
          : undefined,
      isActive:
        typeof req.body?.isActive === "boolean" ? req.body.isActive : undefined,
      createdBy: auth.actorId,
    });

    return res.status(201).json({
      message: "Tạo gói giá thành công.",
      data: created,
    });
  }),
);

/**
 * PUT /api/v1/admin/payment-packages/:code
 * @summary Update payment package
 * @tags Admin
 * @security bearerAuth
 * @param {string} code.path.required - Package code
 * @param {object} request.body.required - Package update payload
 * @return {object} 200 - Package updated
 * @return {object} 400 - Invalid payload
 * @return {object} 403 - Forbidden
 * @return {object} 404 - Package not found
 * @return {object} 500 - Internal Server Error
 */
router.put(
  "/payment-packages/:code",
  asyncHandler(async (req, res) => {
    await assertAdminAccess(req);

    const packageCode =
      typeof req.params.code === "string" ? req.params.code.trim() : "";
    const updated = await updatePaymentPackage(packageCode, {
      name: typeof req.body?.name === "string" ? req.body.name : undefined,
      amount:
        req.body?.amount === undefined ? undefined : Number(req.body.amount),
      currency:
        typeof req.body?.currency === "string" ? req.body.currency : undefined,
      durationDays:
        req.body?.durationDays === undefined
          ? undefined
          : Number(req.body.durationDays),
      poiQuota:
        req.body?.poiQuota === undefined
          ? undefined
          : Number(req.body.poiQuota),
      description:
        typeof req.body?.description === "string"
          ? req.body.description
          : undefined,
      isActive:
        typeof req.body?.isActive === "boolean" ? req.body.isActive : undefined,
    });

    return res.status(200).json({
      message: "Cập nhật gói giá thành công.",
      data: updated,
    });
  }),
);

/**
 * DELETE /api/v1/admin/payment-packages/:code
 * @summary Delete payment package
 * @tags Admin
 * @security bearerAuth
 * @param {string} code.path.required - Package code
 * @return {object} 200 - Package deleted
 * @return {object} 403 - Forbidden
 * @return {object} 404 - Package not found
 * @return {object} 500 - Internal Server Error
 */
router.delete(
  "/payment-packages/:code",
  asyncHandler(async (req, res) => {
    await assertAdminAccess(req);

    const packageCode =
      typeof req.params.code === "string" ? req.params.code.trim() : "";
    const deleted = await deletePaymentPackage(packageCode);

    return res.status(200).json({
      message: "Đã xóa gói giá.",
      data: deleted,
    });
  }),
);

export default router;
