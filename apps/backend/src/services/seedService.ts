import { AnalyticsAction, PoiType } from '../generated/prisma/client';

const SUPPORTED_LANGS = ['vi', 'en', 'ko', 'zh', 'ja', 'th'] as const;

export interface SeedPoi {
  id: string;
  slug: string;
  name: Record<string, string>;
  description: Record<string, string>;
  audioUrls: Record<string, string>;
  latitude: string;
  longitude: string;
  type: PoiType;
  image: string;
  contentVersion: number;
}

export interface SeedTour {
  id: string;
  name: Record<string, string>;
  description: Record<string, string>;
  duration: number;
  poiIds: string[];
  image: string;
  contentVersion: number;
}

export interface SeedAnalyticsEvent {
  deviceId: string;
  sessionId: string;
  poiId: string;
  action: AnalyticsAction;
  durationMs: number;
  language: string;
  timestamp: bigint;
  uploaded: boolean;
}

export interface SeedDataset {
  pois: SeedPoi[];
  tours: SeedTour[];
  analyticsEvents: SeedAnalyticsEvent[];
}

function localize(baseVi: string, baseEn: string): Record<string, string> {
  return {
    vi: baseVi,
    en: baseEn,
    ko: `${baseEn} (KO)`,
    zh: `${baseEn} (ZH)`,
    ja: `${baseEn} (JA)`,
    th: `${baseEn} (TH)`
  };
}

function buildAudioUrls(slug: string): Record<string, string> {
  return SUPPORTED_LANGS.reduce<Record<string, string>>((acc, lang) => {
    acc[lang] = `https://cdn.phoamthuc.local/audio/${lang}/${slug}.mp3`;
    return acc;
  }, {});
}

function validateCoordinates(poi: SeedPoi): void {
  const lat = Number.parseFloat(poi.latitude);
  const lon = Number.parseFloat(poi.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error(`Invalid coordinates for ${poi.id}`);
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new Error(`Coordinates out of range for ${poi.id}`);
  }
}

export function buildSeedDataset(contentVersion = 1, nowMs = Date.now()): SeedDataset {
  const pois: SeedPoi[] = [
    {
      id: 'poi-uuid-1',
      slug: 'pho-thin-lo-duc',
      name: localize('Pho Thin Lo Duc', 'Pho Thin Lo Duc'),
      description: localize('Pho bo xao lan dac trung Ha Noi', 'Classic Hanoi stir-fried beef pho'),
      audioUrls: buildAudioUrls('pho-thin-lo-duc'),
      latitude: '21.016300',
      longitude: '105.855700',
      type: PoiType.FOOD,
      image: 'https://cdn.phoamthuc.local/poi/pho-thin-lo-duc.jpg',
      contentVersion
    },
    {
      id: 'poi-uuid-2',
      slug: 'bun-cha-huong-lien',
      name: localize('Bun Cha Huong Lien', 'Bun Cha Huong Lien'),
      description: localize('Bun cha nuong than hoa noi tieng', 'Iconic charcoal grilled bun cha'),
      audioUrls: buildAudioUrls('bun-cha-huong-lien'),
      latitude: '21.017900',
      longitude: '105.852100',
      type: PoiType.FOOD,
      image: 'https://cdn.phoamthuc.local/poi/bun-cha-huong-lien.jpg',
      contentVersion
    },
    {
      id: 'poi-uuid-3',
      slug: 'ca-phe-giang',
      name: localize('Ca phe Giang', 'Giang Egg Coffee'),
      description: localize('Ca phe trung truyen thong Ha Noi', 'Traditional Hanoi egg coffee'),
      audioUrls: buildAudioUrls('ca-phe-giang'),
      latitude: '21.033900',
      longitude: '105.851000',
      type: PoiType.DRINK,
      image: 'https://cdn.phoamthuc.local/poi/ca-phe-giang.jpg',
      contentVersion
    },
    {
      id: 'poi-uuid-4',
      slug: 'banh-mi-25',
      name: localize('Banh Mi 25', 'Banh Mi 25'),
      description: localize('Banh mi nong gion voi nhieu nhan', 'Crispy banh mi with rich fillings'),
      audioUrls: buildAudioUrls('banh-mi-25'),
      latitude: '21.035300',
      longitude: '105.849500',
      type: PoiType.SNACK,
      image: 'https://cdn.phoamthuc.local/poi/banh-mi-25.jpg',
      contentVersion
    },
    {
      id: 'poi-uuid-5',
      slug: 'xoi-yen',
      name: localize('Xoi Yen', 'Xoi Yen'),
      description: localize('Xoi nong voi do an kem da dang', 'Sticky rice with varied toppings'),
      audioUrls: buildAudioUrls('xoi-yen'),
      latitude: '21.031600',
      longitude: '105.850200',
      type: PoiType.FOOD,
      image: 'https://cdn.phoamthuc.local/poi/xoi-yen.jpg',
      contentVersion
    },
    {
      id: 'poi-uuid-6',
      slug: 'cha-ca-thang-long',
      name: localize('Cha Ca Thang Long', 'Cha Ca Thang Long'),
      description: localize('Cha ca Lang Vong phuc vu tai ban', 'Turmeric fish with dill served hot'),
      audioUrls: buildAudioUrls('cha-ca-thang-long'),
      latitude: '21.033000',
      longitude: '105.847800',
      type: PoiType.FOOD,
      image: 'https://cdn.phoamthuc.local/poi/cha-ca-thang-long.jpg',
      contentVersion
    },
    {
      id: 'poi-uuid-7',
      slug: 'nom-bo-kho-ho-hoan-kiem',
      name: localize('Nom Bo Kho Ho Hoan Kiem', 'Hoan Kiem Dried Beef Salad'),
      description: localize('Nom du du bo kho chua ngot cay', 'Tangy papaya salad with dried beef'),
      audioUrls: buildAudioUrls('nom-bo-kho-ho-hoan-kiem'),
      latitude: '21.029200',
      longitude: '105.852900',
      type: PoiType.SNACK,
      image: 'https://cdn.phoamthuc.local/poi/nom-bo-kho-ho-hoan-kiem.jpg',
      contentVersion
    },
    {
      id: 'poi-uuid-8',
      slug: 'che-4-mua',
      name: localize('Che 4 Mua', 'Che 4 Mua'),
      description: localize('Che truyen thong theo mua', 'Seasonal sweet dessert bowls'),
      audioUrls: buildAudioUrls('che-4-mua'),
      latitude: '21.028300',
      longitude: '105.854300',
      type: PoiType.SNACK,
      image: 'https://cdn.phoamthuc.local/poi/che-4-mua.jpg',
      contentVersion
    },
    {
      id: 'poi-uuid-9',
      slug: 'tra-da-via-he',
      name: localize('Tra Da Via He', 'Street Iced Tea Stop'),
      description: localize('Diem dung chan uong tra da gia re', 'Budget iced tea roadside stop'),
      audioUrls: buildAudioUrls('tra-da-via-he'),
      latitude: '21.030700',
      longitude: '105.847100',
      type: PoiType.DRINK,
      image: 'https://cdn.phoamthuc.local/poi/tra-da-via-he.jpg',
      contentVersion
    },
    {
      id: 'poi-uuid-10',
      slug: 'public-rest-stop',
      name: localize('Diem dung tien ich', 'Public Rest Stop'),
      description: localize('Khu ve sinh cong cong gan tuyen am thuc', 'Public restroom near food route'),
      audioUrls: buildAudioUrls('public-rest-stop'),
      latitude: '21.027400',
      longitude: '105.850900',
      type: PoiType.WC,
      image: 'https://cdn.phoamthuc.local/poi/public-rest-stop.jpg',
      contentVersion
    }
  ];

  pois.forEach((poi) => validateCoordinates(poi));

  const tours: SeedTour[] = [
    {
      id: 'tour-uuid-1',
      name: localize('Lo trinh Buoi Sang', 'Morning Route'),
      description: localize('Bua sang voi pho, bun cha va ca phe', 'Breakfast route with pho, bun cha and coffee'),
      duration: 120,
      poiIds: ['poi-uuid-1', 'poi-uuid-2', 'poi-uuid-3'],
      image: 'https://cdn.phoamthuc.local/tours/morning.jpg',
      contentVersion
    },
    {
      id: 'tour-uuid-2',
      name: localize('Lo trinh Pho Co', 'Old Quarter Walk'),
      description: localize('Kham pha mon an vat pho co', 'Street snack walk in old quarter'),
      duration: 95,
      poiIds: ['poi-uuid-4', 'poi-uuid-7', 'poi-uuid-8', 'poi-uuid-9'],
      image: 'https://cdn.phoamthuc.local/tours/old-quarter.jpg',
      contentVersion
    },
    {
      id: 'tour-uuid-3',
      name: localize('Lo trinh Gia dinh', 'Family Comfort Tour'),
      description: localize('Mon ngon de an va diem dung tien ich', 'Family-friendly stops with comfort food'),
      duration: 110,
      poiIds: ['poi-uuid-5', 'poi-uuid-6', 'poi-uuid-10'],
      image: 'https://cdn.phoamthuc.local/tours/family.jpg',
      contentVersion
    }
  ];

  const analyticsEvents: SeedAnalyticsEvent[] = [
    {
      deviceId: 'seed-device-001',
      sessionId: 'seed-session-001',
      poiId: 'poi-uuid-1',
      action: AnalyticsAction.PLAY,
      durationMs: 0,
      language: 'vi-VN',
      timestamp: BigInt(nowMs),
      uploaded: false
    },
    {
      deviceId: 'seed-device-001',
      sessionId: 'seed-session-001',
      poiId: 'poi-uuid-1',
      action: AnalyticsAction.PAUSE,
      durationMs: 18000,
      language: 'vi-VN',
      timestamp: BigInt(nowMs + 18_000),
      uploaded: false
    },
    {
      deviceId: 'seed-device-001',
      sessionId: 'seed-session-001',
      poiId: 'poi-uuid-2',
      action: AnalyticsAction.STOP,
      durationMs: 42000,
      language: 'en-US',
      timestamp: BigInt(nowMs + 42_000),
      uploaded: false
    },
    {
      deviceId: 'seed-device-002',
      sessionId: 'seed-session-002',
      poiId: 'poi-uuid-4',
      action: AnalyticsAction.QR_SCAN,
      durationMs: 0,
      language: 'ko-KR',
      timestamp: BigInt(nowMs + 55_000),
      uploaded: false
    },
    {
      deviceId: 'seed-device-003',
      sessionId: 'seed-session-003',
      poiId: 'poi-uuid-6',
      action: AnalyticsAction.PLAY,
      durationMs: 0,
      language: 'zh-CN',
      timestamp: BigInt(nowMs + 70_000),
      uploaded: false
    }
  ];

  return {
    pois,
    tours,
    analyticsEvents
  };
}
