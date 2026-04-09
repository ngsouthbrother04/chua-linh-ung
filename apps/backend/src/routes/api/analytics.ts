import { Router } from 'express';
import { processBatchEvents, processPresenceHeartbeat, getAnalyticsStats } from '../../services/analyticsService';
import { requireAuth, requireRole } from '../../middlewares/authMiddleware';
import asyncHandler from '../../utils/asyncHandler';

const router = Router();

/**
 * POST /api/v1/analytics/events
 * @summary Process batch analytics events
 * @description Submit buffered events (play, pause, stop, QR scans) from mobile client
 * @tags Analytics
 * @param {object} request.body.required - Batch events container
 * @param {array} request.body.events.required - Array of analytics events
 * @return {object} 200 - Success response with processing count
 * @return {object} 400 - Invalid event format
 * @return {object} 401 - Unauthorized
 * @return {object} 500 - Internal Server Error
 */
router.post(
  '/events',
  requireAuth,
  requireRole(['USER']),
  asyncHandler(async (req, res) => {
    const { events } = req.body;

    const processedCount = await processBatchEvents(events);

    return res.status(200).json({
      status: 'success',
      processedCount,
      failedCount: (!events || !Array.isArray(events)) ? 0 : (events.length - processedCount)
    });
  })
);

/**
 * POST /api/v1/analytics/presence/heartbeat
 * @summary Report user presence heartbeat
 * @description Submit device heartbeat to track user online status (every 30s typical)
 * @tags Analytics
 * @param {object} request.body.required - Heartbeat data
 * @param {string} request.body.deviceId - Unique device identifier
 * @param {string} request.body.timestamp - Event timestamp
 * @return {object} 200 - Success response with heartbeat acknowledgment
 * @return {object} 400 - Invalid heartbeat format
 * @return {object} 401 - Unauthorized
 * @return {object} 500 - Internal Server Error
 */
router.post(
  '/presence/heartbeat',
  requireAuth,
  requireRole(['USER']),
  asyncHandler(async (req, res) => {
    const result = await processPresenceHeartbeat(req.body);

    return res.status(200).json({
      status: 'success',
      ...result
    });
  })
);

/**
 * GET /api/v1/analytics/stats
 * @summary Get analytics statistics
 * @description Retrieve current analytics summary (active users, event counts, online now)
 * @tags Analytics
 * @return {object} 200 - Success response with statistics
 * @return {object} 401 - Unauthorized
 * @return {object} 500 - Internal Server Error
 */
router.get(
  '/stats',
  requireAuth,
  requireRole(['ADMIN']),
  asyncHandler(async (req, res) => {
    const stats = await getAnalyticsStats();

    return res.status(200).json({
      status: 'success',
      data: stats
    });
  })
);

export default router;
