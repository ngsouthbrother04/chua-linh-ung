import { Router } from 'express';
import { getSyncFull, getSyncManifest, getSyncIncremental } from '../../services/syncService';
import { isUserPremium } from '../../services/authService';
import { requireAuth, AuthRequest } from '../../middlewares/authMiddleware';
import asyncHandler from '../../utils/asyncHandler';
import ApiError from '../../utils/ApiError';

const router = Router();

router.get(
  '/manifest',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const isPremium = await isUserPremium(req.user?.sub);
    const manifest = await getSyncManifest(isPremium);
    return res.status(200).json(manifest);
  })
);

router.get(
  '/full',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const isPremium = await isUserPremium(req.user?.sub);

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

router.post(
  '/incremental',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const isPremium = await isUserPremium(req.user?.sub);
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
