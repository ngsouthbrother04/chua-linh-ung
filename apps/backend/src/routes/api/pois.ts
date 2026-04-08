import { Router } from 'express';
import { getPublicPois, getPublicPoiById, searchPoisByRadius } from '../../services/poiPublicService';
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
 * GET /api/v1/pois
 * @summary Get all POIs
 * @description Retrieve paginated list of Points of Interest available to user's subscription level
 * @tags POIs
 * @param {number} page.query - Page number (default: 1)
 * @param {number} limit.query - Items per page (default: 20, max: 100)
 * @return {object} 200 - Success response with POIs array
 * @return {object} 401 - Unauthorized
 * @return {object} 500 - Internal Server Error
 */
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = requireUserId(req);
    const isPremium = await isUserPremium(userId);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const data = await getPublicPois(page, limit, isPremium);
    return res.status(200).json({
      status: 'success',
      data
    });
  })
);

/**
 * GET /api/v1/pois/:id
 * @summary Get POI by ID
 * @description Retrieve detailed information about a specific Point of Interest
 * @tags POIs
 * @param {string} id.path - POI identifier
 * @return {object} 200 - Success response with POI detail
 * @return {object} 401 - Unauthorized
 * @return {object} 404 - POI not found
 * @return {object} 500 - Internal Server Error
 */
router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = requireUserId(req);
    const isPremium = await isUserPremium(userId);
    const id = String(req.params.id);

    const data = await getPublicPoiById(id, isPremium);
    return res.status(200).json({
      status: 'success',
      data
    });
  })
);

/**
 * POST /api/v1/pois/search/radius
 * @summary Search POIs by radius
 * @description Find Points of Interest within a specified geographic radius
 * @tags POIs
 * @param {object} request.body.required - Search criteria
 * @param {number} request.body.latitude.required - User latitude
 * @param {number} request.body.longitude.required - User longitude
 * @param {number} request.body.radiusM.required - Search radius in meters
 * @param {number} request.body.limit - Max results (default: 20)
 * @return {object} 200 - Success response with nearby POIs
 * @return {object} 400 - Invalid search parameters
 * @return {object} 401 - Unauthorized
 * @return {object} 500 - Internal Server Error
 */
router.post(
  '/search/radius',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = requireUserId(req);
    const isPremium = await isUserPremium(userId);
    const { latitude, longitude, radiusM, limit } = req.body;

    const data = await searchPoisByRadius(
      Number(latitude),
      Number(longitude),
      Number(radiusM),
      Number(limit) || 20,
      isPremium
    );

    return res.status(200).json({
      status: 'success',
      ...data // data contains items and meta
    });
  })
);

export default router;
