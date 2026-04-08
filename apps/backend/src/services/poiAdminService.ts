import { PoiType, Prisma } from '../generated/prisma/client';
import prisma from '../lib/prisma';
import ApiError from '../utils/ApiError';
import { cleanupPoiAudioFiles, enqueuePoiTtsGeneration } from './ttsService';
import { removeCloudinaryImageByUrl } from './imageService';
import { recordAdminAuditEvent } from './adminAuditService';

export interface PoiAdminListItem {
  id: string;
  name: unknown;
  description: unknown;
  audioUrls: unknown;
  latitude: number;
  longitude: number;
  type: PoiType;
  image: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  deletedAt: string | null;
  contentVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface TourAdminItem {
  id: string;
  name: unknown;
  description: unknown;
  duration: number;
  poiIds: string[];
  image: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  deletedAt: string | null;
  contentVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublishAdminPoiResult extends PoiAdminListItem {
  syncVersion: number;
}

export interface InvalidateSyncResult {
  invalidated: true;
  syncVersion: number;
}

export interface PoiAdminCreateInput {
  name: unknown;
  description: unknown;
  latitude: unknown;
  longitude: unknown;
  type: unknown;
  image?: unknown;
  audioUrls?: unknown;
}

export interface TourAdminCreateInput {
  name: unknown;
  description: unknown;
  poiIds: unknown;
  duration?: unknown;
  image?: unknown;
}

export type PoiAdminUpdateInput = Partial<PoiAdminCreateInput>;
export type TourAdminUpdateInput = Partial<TourAdminCreateInput>;

export interface AdminActionContext {
  actor?: string;
  reason?: string;
  source?: string;
}

export interface SoftDeletedPoiCleanupResult {
  dryRun: boolean;
  retentionDays: number;
  cutoffAt: string;
  scanned: number;
  purged: number;
  deletedIds: string[];
  audioFilesRemoved: number;
  imagesRemoved: number;
  imageCleanupFailed: number;
}

const POI_TYPE_VALUES = new Set<string>(Object.values(PoiType));

let softDeleteCleanupTimer: NodeJS.Timeout | null = null;

function normalizeActionContext(context?: AdminActionContext): Required<AdminActionContext> {
  return {
    actor: context?.actor?.trim() || 'unknown',
    reason: context?.reason?.trim() || 'unspecified',
    source: context?.source?.trim() || 'api'
  };
}

function getSoftDeleteRetentionDays(): number {
  const raw = Number(process.env.POI_SOFT_DELETE_RETENTION_DAYS ?? 90);
  if (!Number.isFinite(raw) || raw < 1) {
    return 90;
  }

  return Math.floor(raw);
}

function getSoftDeleteCleanupIntervalMs(): number {
  const rawHours = Number(process.env.POI_SOFT_DELETE_CLEANUP_INTERVAL_HOURS ?? 24);
  if (!Number.isFinite(rawHours) || rawHours <= 0) {
    return 24 * 60 * 60 * 1000;
  }

  return Math.floor(rawHours * 60 * 60 * 1000);
}

function normalizeTextMap(value: unknown, fieldName: string): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ApiError(400, `${fieldName} phải là object JSON hợp lệ.`);
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    throw new ApiError(400, `${fieldName} không được để trống.`);
  }

  const normalized: Record<string, string> = {};
  for (const [language, rawText] of entries) {
    if (typeof rawText !== 'string' || !rawText.trim()) {
      throw new ApiError(400, `${fieldName}.${language} phải là chuỗi không rỗng.`);
    }

    normalized[language.trim()] = rawText.trim();
  }

  return normalized;
}

function getSortedLanguageKeys(value: Record<string, string>): string[] {
  return Object.keys(value).sort((a, b) => a.localeCompare(b));
}

function assertMatchingLanguageSets(name: Record<string, string>, description: Record<string, string>): void {
  const nameKeys = getSortedLanguageKeys(name);
  const descriptionKeys = getSortedLanguageKeys(description);

  if (nameKeys.length !== descriptionKeys.length || nameKeys.some((key, index) => key !== descriptionKeys[index])) {
    throw new ApiError(400, 'name và description phải có cùng tập ngôn ngữ.');
  }
}

function assertAudioUrlsAligned(audioUrls: Record<string, string>, languages: Record<string, string>): void {
  const languageSet = new Set(Object.keys(languages));
  const audioKeys = Object.keys(audioUrls);

  if (audioKeys.length === 0) {
    return;
  }

  const mismatch =
    audioKeys.some((language) => !languageSet.has(language)) ||
    audioKeys.length !== languageSet.size;

  if (mismatch) {
    throw new ApiError(400, 'audioUrls phải khớp toàn bộ ngôn ngữ của name/description.');
  }
}

function normalizeAudioUrls(value: unknown): Record<string, string> {
  if (value === undefined || value === null) {
    return {};
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'audioUrls phải là object JSON hợp lệ.');
  }

  const normalized: Record<string, string> = {};
  for (const [language, rawUrl] of Object.entries(value as Record<string, unknown>)) {
    if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
      throw new ApiError(400, `audioUrls.${language} phải là chuỗi không rỗng.`);
    }

    normalized[language.trim()] = rawUrl.trim();
  }

  return normalized;
}

function normalizePoiType(value: unknown): PoiType {
  if (typeof value !== 'string' || !POI_TYPE_VALUES.has(value)) {
    throw new ApiError(400, 'type phải là một trong FOOD, DRINK, SNACK, WC.');
  }

  return value as PoiType;
}

function normalizeNumericField(value: unknown, fieldName: string): number {
  const numericValue = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : Number.NaN;

  if (!Number.isFinite(numericValue)) {
    throw new ApiError(400, `${fieldName} phải là số hợp lệ.`);
  }

  return numericValue;
}

function normalizeNullableString(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new ApiError(400, 'image phải là chuỗi hoặc null.');
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function normalizePoiIds(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value)) {
    throw new ApiError(400, `${fieldName} phải là mảng POI id hợp lệ.`);
  }

  const normalized: string[] = [];
  for (const rawId of value) {
    if (typeof rawId !== 'string' || !rawId.trim()) {
      throw new ApiError(400, `${fieldName} chỉ chứa chuỗi POI id không rỗng.`);
    }

    normalized.push(rawId.trim());
  }

  const uniqueIds = new Set(normalized);
  if (uniqueIds.size !== normalized.length) {
    throw new ApiError(400, `${fieldName} không được chứa POI id trùng lặp.`);
  }

  return normalized;
}

function normalizeDuration(value: unknown): number {
  if (value === undefined) {
    return 0;
  }

  const duration = normalizeNumericField(value, 'duration');
  if (!Number.isInteger(duration) || duration < 0) {
    throw new ApiError(400, 'duration phải là số nguyên không âm.');
  }

  return duration;
}

async function assertExistingPoiIds(poiIds: string[]): Promise<void> {
  if (poiIds.length === 0) {
    return;
  }

  const existingPois = await prisma.pointOfInterest.findMany({
    where: {
      id: { in: poiIds },
      deletedAt: null
    },
    select: {
      id: true
    }
  });

  const existingSet = new Set(existingPois.map((poi) => poi.id));
  const missingPoiIds = poiIds.filter((poiId) => !existingSet.has(poiId));
  if (missingPoiIds.length > 0) {
    throw new ApiError(400, `Danh sach POI khong hop le: ${missingPoiIds.join(', ')}.`);
  }
}

function toAdminPoiRecord(poi: {
  id: string;
  name: unknown;
  description: unknown;
  audioUrls: unknown;
  latitude: unknown;
  longitude: unknown;
  type: PoiType;
  image: string | null;
  isPublished: boolean;
  publishedAt: Date | null;
  deletedAt: Date | null;
  contentVersion: number;
  createdAt: Date;
  updatedAt: Date;
}): PoiAdminListItem {
  return {
    id: poi.id,
    name: poi.name,
    description: poi.description,
    audioUrls: poi.audioUrls,
    latitude: Number(poi.latitude),
    longitude: Number(poi.longitude),
    type: poi.type,
    image: poi.image,
    isPublished: poi.isPublished,
    publishedAt: poi.publishedAt?.toISOString() ?? null,
    deletedAt: poi.deletedAt?.toISOString() ?? null,
    contentVersion: poi.contentVersion,
    createdAt: poi.createdAt.toISOString(),
    updatedAt: poi.updatedAt.toISOString()
  };
}

function toAdminTourRecord(tour: {
  id: string;
  name: unknown;
  description: unknown;
  duration: number;
  poiIds: unknown;
  image: string | null;
  isPublished: boolean;
  publishedAt: Date | null;
  deletedAt: Date | null;
  contentVersion: number;
  createdAt: Date;
  updatedAt: Date;
}): TourAdminItem {
  return {
    id: tour.id,
    name: tour.name,
    description: tour.description,
    duration: tour.duration,
    poiIds: Array.isArray(tour.poiIds)
      ? tour.poiIds
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim())
      : [],
    image: tour.image,
    isPublished: tour.isPublished,
    publishedAt: tour.publishedAt?.toISOString() ?? null,
    deletedAt: tour.deletedAt?.toISOString() ?? null,
    contentVersion: tour.contentVersion,
    createdAt: tour.createdAt.toISOString(),
    updatedAt: tour.updatedAt.toISOString()
  };
}

export async function listAdminPois(): Promise<PoiAdminListItem[]> {
  const pois = await prisma.pointOfInterest.findMany({
    where: { deletedAt: null },
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    select: {
      id: true,
      name: true,
      description: true,
      audioUrls: true,
      latitude: true,
      longitude: true,
      type: true,
      image: true,
      isPublished: true,
      publishedAt: true,
      deletedAt: true,
      contentVersion: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return pois.map((poi) => toAdminPoiRecord(poi));
}

export async function getAdminPoiById(poiId: string): Promise<PoiAdminListItem> {
  const poi = await prisma.pointOfInterest.findFirst({
    where: { id: poiId, deletedAt: null },
    select: {
      id: true,
      name: true,
      description: true,
      audioUrls: true,
      latitude: true,
      longitude: true,
      type: true,
      image: true,
      isPublished: true,
      publishedAt: true,
      deletedAt: true,
      contentVersion: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!poi) {
    throw new ApiError(404, 'Không tìm thấy POI.');
  }

  return toAdminPoiRecord(poi);
}

export async function createAdminPoi(input: PoiAdminCreateInput, context?: AdminActionContext): Promise<PoiAdminListItem> {
  const name = normalizeTextMap(input.name, 'name');
  const description = normalizeTextMap(input.description, 'description');
  assertMatchingLanguageSets(name, description);
  const latitude = normalizeNumericField(input.latitude, 'latitude');
  const longitude = normalizeNumericField(input.longitude, 'longitude');
  const type = normalizePoiType(input.type);
  const image = normalizeNullableString(input.image) ?? null;
  const audioUrls = normalizeAudioUrls(input.audioUrls);
  assertAudioUrlsAligned(audioUrls, description);

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new ApiError(400, 'latitude/longitude nằm ngoài phạm vi hợp lệ.');
  }

  const poi = await prisma.pointOfInterest.create({
    data: {
      name,
      description,
      audioUrls,
      latitude,
      longitude,
      type,
      image
    },
    select: {
      id: true,
      name: true,
      description: true,
      audioUrls: true,
      latitude: true,
      longitude: true,
      type: true,
      image: true,
      isPublished: true,
      publishedAt: true,
      deletedAt: true,
      contentVersion: true,
      createdAt: true,
      updatedAt: true
    }
  });

  const action = normalizeActionContext(context);
  await recordAdminAuditEvent({
    action: 'poi.create',
    entity: 'poi',
    entityId: poi.id,
    actor: action.actor,
    reason: action.reason,
    source: action.source,
    metadata: {
      contentVersion: poi.contentVersion,
      isPublished: poi.isPublished
    }
  });

  return toAdminPoiRecord(poi);
}

export async function createAdminTour(input: TourAdminCreateInput, context?: AdminActionContext): Promise<TourAdminItem> {
  const name = normalizeTextMap(input.name, 'name');
  const description = normalizeTextMap(input.description, 'description');
  assertMatchingLanguageSets(name, description);
  const poiIds = normalizePoiIds(input.poiIds, 'poiIds');
  await assertExistingPoiIds(poiIds);
  const duration = normalizeDuration(input.duration);
  const image = normalizeNullableString(input.image) ?? null;

  const tour = await prisma.$transaction(async (tx) => {
    const createdTour = await tx.tour.create({
      data: {
        name,
        description,
        duration,
        poiIds: poiIds as unknown as Prisma.InputJsonValue,
        image,
        isPublished: true,
        publishedAt: new Date()
      },
      select: {
        id: true,
        name: true,
        description: true,
        duration: true,
        poiIds: true,
        image: true,
        isPublished: true,
        publishedAt: true,
        deletedAt: true,
        contentVersion: true,
        createdAt: true,
        updatedAt: true
      }
    });

    await bumpSyncVersion(tx);
    return createdTour;
  });

  const action = normalizeActionContext(context);
  await recordAdminAuditEvent({
    action: 'tour.create',
    entity: 'tour',
    entityId: tour.id,
    actor: action.actor,
    reason: action.reason,
    source: action.source,
    metadata: {
      contentVersion: tour.contentVersion,
      isPublished: tour.isPublished
    }
  });

  return toAdminTourRecord(tour);
}

export async function updateAdminPoi(poiId: string, input: PoiAdminUpdateInput, context?: AdminActionContext): Promise<PoiAdminListItem> {
  const existingPoi = await prisma.pointOfInterest.findFirst({
    where: { id: poiId, deletedAt: null },
    select: {
      id: true,
      name: true,
      description: true,
      audioUrls: true,
      latitude: true,
      longitude: true,
      type: true,
      image: true
    }
  });

  if (!existingPoi) {
    throw new ApiError(404, 'Không tìm thấy POI.');
  }

  const name = input.name !== undefined ? normalizeTextMap(input.name, 'name') : undefined;
  const description = input.description !== undefined ? normalizeTextMap(input.description, 'description') : undefined;
  const latitude = input.latitude !== undefined ? normalizeNumericField(input.latitude, 'latitude') : undefined;
  const longitude = input.longitude !== undefined ? normalizeNumericField(input.longitude, 'longitude') : undefined;
  const type = input.type !== undefined ? normalizePoiType(input.type) : undefined;
  const image = input.image !== undefined ? normalizeNullableString(input.image) : undefined;
  const audioUrls = input.audioUrls !== undefined ? normalizeAudioUrls(input.audioUrls) : undefined;

  const mergedName = name ?? normalizeTextMap(existingPoi.name, 'name');
  const mergedDescription = description ?? normalizeTextMap(existingPoi.description, 'description');
  assertMatchingLanguageSets(mergedName, mergedDescription);

  if (audioUrls !== undefined) {
    assertAudioUrlsAligned(audioUrls, mergedDescription);
  }

  if (latitude !== undefined && (latitude < -90 || latitude > 90)) {
    throw new ApiError(400, 'latitude nằm ngoài phạm vi hợp lệ.');
  }

  if (longitude !== undefined && (longitude < -180 || longitude > 180)) {
    throw new ApiError(400, 'longitude nằm ngoài phạm vi hợp lệ.');
  }

  const updatedPoi = await prisma.pointOfInterest.update({
    where: { id: poiId },
    data: {
      name,
      description,
      latitude,
      longitude,
      type,
      image,
      audioUrls,
      isPublished: false,
      publishedAt: null,
      contentVersion: {
        increment: 1
      }
    },
    select: {
      id: true,
      name: true,
      description: true,
      audioUrls: true,
      latitude: true,
      longitude: true,
      type: true,
      image: true,
      isPublished: true,
      publishedAt: true,
      deletedAt: true,
      contentVersion: true,
      createdAt: true,
      updatedAt: true
    }
  });

  const action = normalizeActionContext(context);
  await recordAdminAuditEvent({
    action: 'poi.update',
    entity: 'poi',
    entityId: poiId,
    actor: action.actor,
    reason: action.reason,
    source: action.source,
    metadata: {
      contentVersion: updatedPoi.contentVersion,
      isPublished: updatedPoi.isPublished
    }
  });

  // Auto-trigger TTS generation if description changed
  if (description !== undefined) {
    try {
      await enqueuePoiTtsGeneration(poiId);
    } catch (error) {
      console.error('[POI Update] Failed to enqueue TTS generation', { poiId, error });
      // Don't throw - TTS queueing failure should not block POI update
    }
  }

  return toAdminPoiRecord(updatedPoi);
}

export async function getAdminTourById(tourId: string): Promise<TourAdminItem> {
  const tour = await prisma.tour.findFirst({
    where: { id: tourId, deletedAt: null },
    select: {
      id: true,
      name: true,
      description: true,
      duration: true,
      poiIds: true,
      image: true,
      isPublished: true,
      publishedAt: true,
      deletedAt: true,
      contentVersion: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!tour) {
    throw new ApiError(404, 'Không tìm thấy Tour.');
  }

  return toAdminTourRecord(tour);
}

export async function updateAdminTour(tourId: string, input: TourAdminUpdateInput, context?: AdminActionContext): Promise<TourAdminItem> {
  const existingTour = await prisma.tour.findFirst({
    where: { id: tourId, deletedAt: null },
    select: {
      id: true,
      name: true,
      description: true,
      duration: true,
      poiIds: true,
      image: true
    }
  });

  if (!existingTour) {
    throw new ApiError(404, 'Không tìm thấy Tour.');
  }

  const name = input.name !== undefined ? normalizeTextMap(input.name, 'name') : undefined;
  const description = input.description !== undefined ? normalizeTextMap(input.description, 'description') : undefined;
  const poiIds = input.poiIds !== undefined ? normalizePoiIds(input.poiIds, 'poiIds') : undefined;
  const duration = input.duration !== undefined ? normalizeDuration(input.duration) : undefined;
  const image = input.image !== undefined ? normalizeNullableString(input.image) : undefined;

  const mergedName = name ?? normalizeTextMap(existingTour.name, 'name');
  const mergedDescription = description ?? normalizeTextMap(existingTour.description, 'description');
  assertMatchingLanguageSets(mergedName, mergedDescription);

  if (poiIds !== undefined) {
    await assertExistingPoiIds(poiIds);
  }

  const tour = await prisma.$transaction(async (tx) => {
    const updatedTour = await tx.tour.update({
      where: { id: tourId },
      data: {
        name,
        description,
        duration,
        poiIds: poiIds !== undefined ? (poiIds as unknown as Prisma.InputJsonValue) : undefined,
        image,
        isPublished: true,
        publishedAt: new Date(),
        contentVersion: {
          increment: 1
        }
      },
      select: {
        id: true,
        name: true,
        description: true,
        duration: true,
        poiIds: true,
        image: true,
        isPublished: true,
        publishedAt: true,
        deletedAt: true,
        contentVersion: true,
        createdAt: true,
        updatedAt: true
      }
    });

    await bumpSyncVersion(tx);
    return updatedTour;
  });

  const action = normalizeActionContext(context);
  await recordAdminAuditEvent({
    action: 'tour.update',
    entity: 'tour',
    entityId: tour.id,
    actor: action.actor,
    reason: action.reason,
    source: action.source,
    metadata: {
      contentVersion: tour.contentVersion,
      isPublished: tour.isPublished
    }
  });

  return toAdminTourRecord(tour);
}

async function bumpSyncVersion(tx: Prisma.TransactionClient): Promise<number> {
  const existingSetting = await tx.appSetting.findUnique({
    where: { id: 1 },
    select: { currentVersion: true }
  });

  if (!existingSetting) {
    const created = await tx.appSetting.create({
      data: {
        id: 1,
        currentVersion: 2
      },
      select: {
        currentVersion: true
      }
    });

    return created.currentVersion;
  }

  const updated = await tx.appSetting.update({
    where: { id: 1 },
    data: {
      currentVersion: {
        increment: 1
      }
    },
    select: {
      currentVersion: true
    }
  });

  return updated.currentVersion;
}

export async function publishAdminPoi(poiId: string, context?: AdminActionContext): Promise<PublishAdminPoiResult> {
  const existingPoi = await prisma.pointOfInterest.findFirst({
    where: { id: poiId, deletedAt: null },
    select: { id: true }
  });

  if (!existingPoi) {
    throw new ApiError(404, 'Không tìm thấy POI.');
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedPoi = await tx.pointOfInterest.update({
      where: { id: poiId },
      data: {
        isPublished: true,
        publishedAt: new Date()
      },
      select: {
        id: true,
        name: true,
        description: true,
        audioUrls: true,
        latitude: true,
        longitude: true,
        type: true,
        image: true,
        isPublished: true,
        publishedAt: true,
        deletedAt: true,
        contentVersion: true,
        createdAt: true,
        updatedAt: true
      }
    });

    const syncVersion = await bumpSyncVersion(tx);

    return {
      ...toAdminPoiRecord(updatedPoi),
      syncVersion
    };
  });

  const action = normalizeActionContext(context);
  await recordAdminAuditEvent({
    action: 'poi.publish',
    entity: 'poi',
    entityId: poiId,
    actor: action.actor,
    reason: action.reason,
    source: action.source,
    metadata: {
      syncVersion: result.syncVersion,
      contentVersion: result.contentVersion
    }
  });

  return result;
}

export async function invalidateSyncManifest(): Promise<InvalidateSyncResult> {
  const syncVersion = await prisma.$transaction(async (tx) => bumpSyncVersion(tx));

  return {
    invalidated: true,
    syncVersion
  };
}

export async function deleteAdminPoi(poiId: string, context?: AdminActionContext): Promise<PoiAdminListItem> {
  const existingPoi = await prisma.pointOfInterest.findFirst({
    where: { id: poiId, deletedAt: null },
    select: { id: true }
  });

  if (!existingPoi) {
    throw new ApiError(404, 'Không tìm thấy POI.');
  }

  const relatedTours = await prisma.tour.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      poiIds: true
    }
  });

  const toursToUpdate = relatedTours.filter((tour) => Array.isArray(tour.poiIds) && tour.poiIds.some((value) => value === poiId));

  const deletedPoi = await prisma.$transaction(async (tx) => {
    const updatedPoi = await tx.pointOfInterest.update({
      where: { id: poiId },
      data: {
        deletedAt: new Date(),
        isPublished: false,
        publishedAt: null,
        contentVersion: {
          increment: 1
        }
      },
      select: {
        id: true,
        name: true,
        description: true,
        audioUrls: true,
        latitude: true,
        longitude: true,
        type: true,
        image: true,
        isPublished: true,
        publishedAt: true,
        deletedAt: true,
        contentVersion: true,
        createdAt: true,
        updatedAt: true
      }
    });

    for (const tour of toursToUpdate) {
      const nextPoiIds = (tour.poiIds as unknown[]).filter((value) => value !== poiId);
      await tx.tour.update({
        where: { id: tour.id },
        data: {
          poiIds: nextPoiIds as unknown as Prisma.InputJsonValue,
          contentVersion: {
            increment: 1
          }
        }
      });
    }

    await bumpSyncVersion(tx);

    return updatedPoi;
  });

  void cleanupPoiAudioFiles(poiId).catch((error) => {
    console.warn('[POI] Failed to cleanup audio files for deleted POI', { poiId, error });
  });

  const action = normalizeActionContext(context);
  await recordAdminAuditEvent({
    action: 'poi.soft_delete',
    entity: 'poi',
    entityId: poiId,
    actor: action.actor,
    reason: action.reason,
    source: action.source,
    metadata: {
      contentVersion: deletedPoi.contentVersion
    }
  });

  return toAdminPoiRecord(deletedPoi);
}

export async function deleteAdminTour(tourId: string, context?: AdminActionContext): Promise<TourAdminItem> {
  const existingTour = await prisma.tour.findFirst({
    where: { id: tourId, deletedAt: null },
    select: { id: true }
  });

  if (!existingTour) {
    throw new ApiError(404, 'Không tìm thấy Tour.');
  }

  const deletedTour = await prisma.$transaction(async (tx) => {
    const updatedTour = await tx.tour.update({
      where: { id: tourId },
      data: {
        deletedAt: new Date(),
        isPublished: false,
        publishedAt: null,
        contentVersion: {
          increment: 1
        }
      },
      select: {
        id: true,
        name: true,
        description: true,
        duration: true,
        poiIds: true,
        image: true,
        isPublished: true,
        publishedAt: true,
        deletedAt: true,
        contentVersion: true,
        createdAt: true,
        updatedAt: true
      }
    });

    await bumpSyncVersion(tx);
    return updatedTour;
  });

  const action = normalizeActionContext(context);
  await recordAdminAuditEvent({
    action: 'tour.soft_delete',
    entity: 'tour',
    entityId: deletedTour.id,
    actor: action.actor,
    reason: action.reason,
    source: action.source,
    metadata: {
      contentVersion: deletedTour.contentVersion
    }
  });

  return toAdminTourRecord(deletedTour);
}

export async function purgeSoftDeletedPois(options?: {
  dryRun?: boolean;
  now?: Date;
  context?: AdminActionContext;
}): Promise<SoftDeletedPoiCleanupResult> {
  const dryRun = options?.dryRun === true;
  const now = options?.now ?? new Date();
  const retentionDays = getSoftDeleteRetentionDays();
  const cutoffAt = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

  const softDeletedPois = await prisma.pointOfInterest.findMany({
    where: {
      deletedAt: {
        lte: cutoffAt
      }
    },
    select: {
      id: true,
      image: true
    },
    orderBy: {
      deletedAt: 'asc'
    }
  });

  if (dryRun || softDeletedPois.length === 0) {
    return {
      dryRun,
      retentionDays,
      cutoffAt: cutoffAt.toISOString(),
      scanned: softDeletedPois.length,
      purged: 0,
      deletedIds: [],
      audioFilesRemoved: 0,
      imagesRemoved: 0,
      imageCleanupFailed: 0
    };
  }

  let audioFilesRemoved = 0;
  let imagesRemoved = 0;
  let imageCleanupFailed = 0;
  const deletedIds: string[] = [];

  for (const poi of softDeletedPois) {
    deletedIds.push(poi.id);
    audioFilesRemoved += await cleanupPoiAudioFiles(poi.id);

    if (poi.image) {
      try {
        const removed = await removeCloudinaryImageByUrl(poi.image);
        if (removed) {
          imagesRemoved += 1;
        }
      } catch (error) {
        imageCleanupFailed += 1;
        console.warn('[POI] Failed to cleanup cloud image during retention purge', {
          poiId: poi.id,
          error
        });
      }
    }
  }

  await prisma.pointOfInterest.deleteMany({
    where: {
      id: {
        in: deletedIds
      }
    }
  });

  const action = normalizeActionContext(options?.context);
  await recordAdminAuditEvent({
    action: 'poi.retention_purge',
    entity: 'system',
    actor: action.actor,
    reason: action.reason,
    source: action.source,
    metadata: {
      retentionDays,
      cutoffAt: cutoffAt.toISOString(),
      purged: deletedIds.length,
      deletedIds,
      audioFilesRemoved,
      imagesRemoved,
      imageCleanupFailed
    }
  });

  return {
    dryRun: false,
    retentionDays,
    cutoffAt: cutoffAt.toISOString(),
    scanned: softDeletedPois.length,
    purged: deletedIds.length,
    deletedIds,
    audioFilesRemoved,
    imagesRemoved,
    imageCleanupFailed
  };
}

export function initializePoiSoftDeleteCleanupScheduler(): NodeJS.Timeout | null {
  const enabled = process.env.POI_SOFT_DELETE_CLEANUP_ENABLED === 'true';
  if (!enabled) {
    return null;
  }

  if (softDeleteCleanupTimer) {
    return softDeleteCleanupTimer;
  }

  const intervalMs = getSoftDeleteCleanupIntervalMs();
  softDeleteCleanupTimer = setInterval(() => {
    void purgeSoftDeletedPois({
      dryRun: false,
      context: {
        actor: 'system',
        reason: 'scheduled retention cleanup',
        source: 'scheduler'
      }
    }).catch((error) => {
      console.error('[POI] Soft delete cleanup scheduler failed', error);
    });
  }, intervalMs);

  softDeleteCleanupTimer.unref();
  return softDeleteCleanupTimer;
}
