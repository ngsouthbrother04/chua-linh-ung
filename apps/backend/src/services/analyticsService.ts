import { AnalyticsAction } from "../generated/prisma/client";
import prisma from "../lib/prisma";
import ApiError from "../utils/ApiError";

export interface AnalyticsEventInput {
  deviceId: string;
  sessionId: string;
  poiId?: string;
  action: string;
  durationMs?: number;
  language?: string;
  timestamp: number;
}

export interface PresenceHeartbeatInput {
  deviceId: string;
  sessionId: string;
  timestamp: number;
  language?: string;
}

export interface PresenceOfflineInput {
  deviceId: string;
  sessionId?: string;
}

const ONLINE_PRESENCE_WINDOW_SECONDS = 0;

export async function processBatchEvents(
  events: AnalyticsEventInput[],
): Promise<number> {
  if (!Array.isArray(events) || events.length === 0) {
    throw new ApiError(400, "Danh sach events khong hop le");
  }

  let processedCount = 0;

  for (const ev of events) {
    try {
      if (!ev.deviceId || !ev.sessionId || !ev.action || !ev.timestamp) {
        continue; // Skip invalid
      }

      const actionEnum = ev.action.toUpperCase() as AnalyticsAction;
      if (!Object.values(AnalyticsAction).includes(actionEnum)) {
        continue;
      }

      await prisma.analyticsEvent.create({
        data: {
          deviceId: ev.deviceId,
          sessionId: ev.sessionId,
          poiId: ev.poiId,
          action: actionEnum,
          durationMs: ev.durationMs,
          language: ev.language,
          timestamp: ev.timestamp,
        },
      });
      processedCount++;
    } catch (e) {
      // If one fails, continue with others (best effort)
      console.error("Failed to insert analytics event", e);
    }
  }

  return processedCount;
}

export async function processPresenceHeartbeat(
  input: PresenceHeartbeatInput,
): Promise<{ onlineNowWindowSec: number; active5mWindowSec: number }> {
  if (!input.deviceId || !input.sessionId || !input.timestamp) {
    throw new ApiError(400, "Missing presence heartbeat required fields");
  }

  await prisma.analyticsPresence.upsert({
    where: { deviceId: input.deviceId },
    update: {
      sessionId: input.sessionId,
      lastHeartbeatAt: new Date(input.timestamp),
      language: input.language,
    },
    create: {
      deviceId: input.deviceId,
      sessionId: input.sessionId,
      lastHeartbeatAt: new Date(input.timestamp),
      language: input.language,
    },
  });

  return {
    onlineNowWindowSec: ONLINE_PRESENCE_WINDOW_SECONDS,
    active5mWindowSec: 300,
  };
}

export async function processPresenceOffline(
  input: PresenceOfflineInput,
): Promise<{ removed: boolean }> {
  if (!input.deviceId) {
    throw new ApiError(400, "Missing presence offline required fields");
  }

  const where = input.sessionId
    ? {
        deviceId: input.deviceId,
        sessionId: input.sessionId,
      }
    : {
        deviceId: input.deviceId,
      };

  const result = await prisma.analyticsPresence.deleteMany({ where });

  return {
    removed: result.count > 0,
  };
}

export async function getAnalyticsStats(): Promise<any> {
  const plays = await prisma.analyticsEvent.count({
    where: { action: AnalyticsAction.PLAY },
  });

  const qrScans = await prisma.analyticsEvent.count({
    where: { action: AnalyticsAction.QR_SCAN },
  });

  const rawTopPois = await prisma.analyticsEvent.groupBy({
    by: ["poiId"],
    where: { action: AnalyticsAction.PLAY, poiId: { not: null } },
    _count: { poiId: true },
    orderBy: { _count: { poiId: "desc" } },
    take: 10,
  });

  const topPois = rawTopPois.map((p) => ({
    poiId: p.poiId as string,
    playCount: p._count.poiId,
  }));

  const onlineSessionRows = await prisma.$queryRaw<
    Array<{ count: bigint | number | string }>
  >`
    SELECT COUNT(DISTINCT session_id) AS count
    FROM analytics_presence
  `;

  const onlineSessions = Number(onlineSessionRows[0]?.count ?? 0);

  return {
    plays,
    qrScans,
    topPois,
    onlineSessions,
    onlineWindowSec: ONLINE_PRESENCE_WINDOW_SECONDS,
  };
}
