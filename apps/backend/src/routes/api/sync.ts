import { Router } from 'express';
import { getSyncFull, getSyncManifest, getSyncIncremental } from '../../services/syncService';
import { isUserPremium } from '../../services/authService';
import { requireAuth, AuthRequest } from '../../middlewares/authMiddleware';
import asyncHandler from '../../utils/asyncHandler';
import ApiError from '../../utils/ApiError';

const router = Router();

function requireUserId(req: AuthRequest): string {
  const userId = req.user?.sub;
  if (!userId) {
    throw new ApiError(401, 'Token rỗng hoặc không hợp lệ.');
  }

  return userId;
}

/**
 * GET /api/v1/sync/manifest
 * @summary Get sync manifest
 * @description Return current content version and metadata for sync decision.
 * @tags Sync
 * @security bearerAuth
 * @return {object} 200 - Manifest response
 * @return {object} 401 - Unauthorized
 * @return {object} 500 - Internal Server Error
 */

router.get(
  '/manifest',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = requireUserId(req);
    const isPremium = await isUserPremium(userId);
    const manifest = await getSyncManifest(isPremium);
    return res.status(200).json(manifest);
  })
);

/**
 * GET /api/v1/sync/full
 * @summary Get full sync payload
 * @description Return full POI and tour content for bootstrap or fallback sync.
 * @tags Sync
 * @security bearerAuth
 * @param {number} version.query - Client content version for short-circuit check
 * @return {object} 200 - Full sync or needsSync false short-circuit response
 * @return {object} 400 - Invalid query parameter
 * @return {object} 401 - Unauthorized
 * @return {object} 500 - Internal Server Error
 */

router.get(
  '/full',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = requireUserId(req);
    const isPremium = await isUserPremium(userId);

    const requestedVersionRaw = typeof req.query.version === 'string' ? req.query.version : undefined;
    const requestedVersion = requestedVersionRaw ? Number(requestedVersionRaw) : undefined;

    if (requestedVersionRaw && !Number.isInteger(requestedVersion)) {
      throw new ApiError(400, 'Query version phải là số nguyên.');
    }

    if (requestedVersion !== undefined) {
      const manifest = await getSyncManifest(isPremium);
      if (requestedVersion >= manifest.contentVersion) {
        return res.status(200).json({
          contentVersion: manifest.contentVersion,
          needsSync: false,
          pois: [],
          tours: []
        });
      }
    }

    const fullData = await getSyncFull(isPremium);
    return res.status(200).json({
      ...fullData,
      needsSync: true
    });
  })
);

/**
 * POST /api/v1/sync/incremental
 * @summary Get incremental sync payload
 * @description Return delta changes from a given version or require full sync.
 * @tags Sync
 * @security bearerAuth
 * @param {object} request.body.required - Incremental sync payload
 * @param {number} request.body.fromVersion.required - Client content version
 * @return {object} 200 - Incremental changes response
 * @return {object} 400 - Invalid body payload
 * @return {object} 401 - Unauthorized
 * @return {object} 409 - Delta window exceeded, full sync required
 * @return {object} 500 - Internal Server Error
 */

router.post(
  '/incremental',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = requireUserId(req);
    const isPremium = await isUserPremium(userId);
    const { fromVersion } = req.body;

    if (fromVersion === undefined || !Number.isInteger(fromVersion)) {
      throw new ApiError(400, 'Body phải chứa fromVersion là số nguyên.');
    }

    const incrementalData = await getSyncIncremental(fromVersion, isPremium);

    if (incrementalData.requiresFullSync) {
      return res.status(409).json({
        status: 'error',
        error: {
          code: 'DELTA_WINDOW_EXCEEDED',
          message: 'Khong the delta sync tu version hien tai, vui long full sync',
          timestamp: new Date().toISOString()
        },
        data: {
          requiresFullSync: true
        }
      });
    }

    return res.status(200).json({
      status: 'success',
      data: incrementalData
    });
  })
);

export default router;
