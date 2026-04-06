import crypto from 'crypto';
import prisma from '../lib/prisma';

const ALLOWED_FREEMIUM_LANGS = ['vi', 'en'];

function stripPremiumLanguages(data: any): any {
  if (!data || typeof data !== 'object') return data;
  const filtered: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (ALLOWED_FREEMIUM_LANGS.includes(k)) {
      filtered[k] = v;
    }
  }
  return filtered;
}

export interface SyncManifestResult {
  contentVersion: number;
  totalPois: number;
  totalTours: number;
  lastUpdatedAt: string;
  checksum: string;
}

export interface SyncFullPoi {
  id: string;
  name: unknown;
  description: unknown;
  audioUrls: unknown;
  latitude: number;
  longitude: number;
  type: string;
  image: string | null;
}

export interface SyncFullTour {
  id: string;
  name: unknown;
  description: unknown;
  duration: number;
  poiIds: unknown;
  image: string | null;
  createdAt: string;
}

export interface SyncFullResult {
  contentVersion: number;
  pois: SyncFullPoi[];
  tours: SyncFullTour[];
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${stableJson(val)}`).join(',')}}`;
}

export async function getSyncManifest(isPremium: boolean = false): Promise<SyncManifestResult> {
  const [settings, pois, tours, poiAggregate, tourAggregate] = await Promise.all([
    prisma.appSetting.findUnique({
      where: { id: 1 },
      select: { currentVersion: true }
    }),
    prisma.pointOfInterest.findMany({
      where: { deletedAt: null, isPublished: true },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        audioUrls: true,
        latitude: true,
        longitude: true,
        type: true,
        image: true,
        contentVersion: true,
        updatedAt: true
      }
    }),
    prisma.tour.findMany({
      where: { deletedAt: null, isPublished: true },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        duration: true,
        poiIds: true,
        image: true,
        contentVersion: true,
        updatedAt: true
      }
    }),
    prisma.pointOfInterest.aggregate({
      _max: {
        contentVersion: true,
        updatedAt: true
      }
    }),
    prisma.tour.aggregate({
      _max: {
        contentVersion: true,
        updatedAt: true
      }
    })
  ]);

  const totalPois = pois.length;
  const totalTours = tours.length;
  const contentVersion = Math.max(settings?.currentVersion ?? 0, poiAggregate._max.contentVersion ?? 0, tourAggregate._max.contentVersion ?? 0);

  const poiUpdatedAtMs = poiAggregate._max.updatedAt?.getTime() ?? 0;
  const tourUpdatedAtMs = tourAggregate._max.updatedAt?.getTime() ?? 0;
  const latestUpdatedAtMs = Math.max(poiUpdatedAtMs, tourUpdatedAtMs);
  const lastUpdatedAt = new Date(latestUpdatedAtMs).toISOString();

  const normalizedPois = pois.map((poi) => ({
    ...poi,
    name: isPremium ? poi.name : stripPremiumLanguages(poi.name),
    description: isPremium ? poi.description : stripPremiumLanguages(poi.description),
    audioUrls: isPremium ? poi.audioUrls : stripPremiumLanguages(poi.audioUrls),
    latitude: poi.latitude.toString(),
    longitude: poi.longitude.toString(),
    updatedAt: poi.updatedAt.toISOString()
  }));

  const normalizedTours = tours.map((tour) => ({
    ...tour,
    name: isPremium ? tour.name : stripPremiumLanguages(tour.name),
    description: isPremium ? tour.description : stripPremiumLanguages(tour.description),
    updatedAt: tour.updatedAt.toISOString()
  }));

  const checksumSource = stableJson({
    contentVersion,
    totalPois,
    totalTours,
    lastUpdatedAt,
    pois: normalizedPois,
    tours: normalizedTours
  });
  const checksum = `sha256-${crypto.createHash('sha256').update(checksumSource).digest('hex')}`;

  return {
    contentVersion,
    totalPois,
    totalTours,
    lastUpdatedAt,
    checksum
  };
}

export async function getSyncFull(isPremium: boolean = false): Promise<SyncFullResult> {
  const [settings, pois, tours, poiAggregate, tourAggregate] = await Promise.all([
    prisma.appSetting.findUnique({
      where: { id: 1 },
      select: { currentVersion: true }
    }),
    prisma.pointOfInterest.findMany({
      where: { deletedAt: null, isPublished: true },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        audioUrls: true,
        latitude: true,
        longitude: true,
        type: true,
        image: true,
        contentVersion: true
      }
    }),
    prisma.tour.findMany({
      where: { deletedAt: null, isPublished: true },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        duration: true,
        poiIds: true,
        image: true,
        contentVersion: true,
        createdAt: true
      }
    }),
    prisma.pointOfInterest.aggregate({
      _max: {
        contentVersion: true
      }
    }),
    prisma.tour.aggregate({
      _max: {
        contentVersion: true
      }
    })
  ]);

  const contentVersion = Math.max(settings?.currentVersion ?? 0, poiAggregate._max.contentVersion ?? 0, tourAggregate._max.contentVersion ?? 0);

  return {
    contentVersion,
    pois: pois.map((poi) => ({
      id: poi.id,
      name: isPremium ? poi.name : stripPremiumLanguages(poi.name),
      description: isPremium ? poi.description : stripPremiumLanguages(poi.description),
      audioUrls: isPremium ? poi.audioUrls : stripPremiumLanguages(poi.audioUrls),
      latitude: Number(poi.latitude),
      longitude: Number(poi.longitude),
      type: poi.type,
      image: poi.image
    })),
    tours: tours.map((tour) => ({
      id: tour.id,
      name: isPremium ? tour.name : stripPremiumLanguages(tour.name),
      description: isPremium ? tour.description : stripPremiumLanguages(tour.description),
      duration: tour.duration,
      poiIds: tour.poiIds,
      image: tour.image,
      createdAt: tour.createdAt.toISOString()
    }))
  };
}

export interface SyncIncrementalResult {
  fromVersion: number;
  toVersion: number;
  changes: {
    pois: SyncFullPoi[];
    tours: SyncFullTour[];
    deletedPoiIds: string[];
    deletedTourIds: string[];
  };
  requiresFullSync: boolean;
}

export async function getSyncIncremental(fromVersion: number, isPremium: boolean = false): Promise<SyncIncrementalResult> {
  const [settings, manifest, pois, tours, deletedPois, deletedTours] = await Promise.all([
    prisma.appSetting.findUnique({
      where: { id: 1 },
      select: { currentVersion: true, deltaWindowVersions: true }
    }),
    getSyncManifest(isPremium),
    prisma.pointOfInterest.findMany({
      where: { deletedAt: null, isPublished: true, contentVersion: { gt: fromVersion } },
      orderBy: { id: 'asc' },
    }),
    prisma.tour.findMany({
      where: { deletedAt: null, isPublished: true, contentVersion: { gt: fromVersion } },
      orderBy: { id: 'asc' },
    }),
    prisma.pointOfInterest.findMany({
      where: { deletedAt: { not: null }, contentVersion: { gt: fromVersion } },
      select: { id: true }
    }),
    prisma.tour.findMany({
      where: { deletedAt: { not: null }, contentVersion: { gt: fromVersion } },
      select: { id: true }
    })
  ]);

  const toVersion = manifest.contentVersion;
  const deltaWindow = settings?.deltaWindowVersions ?? 5;

  if (toVersion - fromVersion > deltaWindow || fromVersion < 0) {
    return {
      fromVersion,
      toVersion,
      changes: { pois: [], tours: [], deletedPoiIds: [], deletedTourIds: [] },
      requiresFullSync: true
    };
  }

  return {
    fromVersion,
    toVersion,
    requiresFullSync: false,
    changes: {
      pois: pois.map((poi) => ({
        id: poi.id,
        name: isPremium ? poi.name : stripPremiumLanguages(poi.name),
        description: isPremium ? poi.description : stripPremiumLanguages(poi.description),
        audioUrls: isPremium ? poi.audioUrls : stripPremiumLanguages(poi.audioUrls),
        latitude: Number(poi.latitude),
        longitude: Number(poi.longitude),
        type: poi.type,
        image: poi.image
      })),
      tours: tours.map((tour) => ({
        id: tour.id,
        name: isPremium ? tour.name : stripPremiumLanguages(tour.name),
        description: isPremium ? tour.description : stripPremiumLanguages(tour.description),
        duration: tour.duration,
        poiIds: tour.poiIds,
        image: tour.image,
        createdAt: tour.createdAt.toISOString()
      })),
      deletedPoiIds: deletedPois.map(p => p.id),
      deletedTourIds: deletedTours.map(t => t.id)
    }
  };
}
