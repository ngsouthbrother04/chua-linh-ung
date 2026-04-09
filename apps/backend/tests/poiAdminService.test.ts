import { describe, expect, it, beforeEach, vi } from 'vitest';
import prisma from '../src/lib/prisma';
vi.mock('../src/services/ttsService', () => ({
  cleanupPoiAudioFiles: vi.fn(async () => 0)
}));
vi.mock('../src/services/imageService', () => ({
  removeCloudinaryImageByUrl: vi.fn(async () => true)
}));
vi.mock('../src/services/adminAuditService', () => ({
  recordAdminAuditEvent: vi.fn(async () => undefined)
}));
import {
  createAdminPoi,
  deleteAdminPoi,
  getAdminPoiById,
  listAdminPois,
  purgeSoftDeletedPois,
  updateAdminPoi
} from '../src/services/poiAdminService';

vi.mock('../src/lib/prisma', () => ({
  default: {
    pointOfInterest: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn()
    },
    tour: {
      findMany: vi.fn(),
      update: vi.fn()
    },
    appSetting: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    $transaction: vi.fn(async (callback: (tx: any) => Promise<unknown>) => callback(prisma as never))
  }
}));

describe('poiAdminService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createAdminPoi should persist a new POI with normalized payload', async () => {
    vi.mocked(prisma.pointOfInterest.create).mockResolvedValue({
      id: 'poi-1',
      name: { vi: 'Phở Thìn' },
      description: { vi: 'Nổi tiếng' },
      audioUrls: {},
      latitude: 21.01,
      longitude: 105.85,
      type: 'FOOD',
      image: null,
      isPublished: false,
      publishedAt: null,
      deletedAt: null,
      contentVersion: 1,
      createdAt: new Date('2026-03-25T00:00:00Z'),
      updatedAt: new Date('2026-03-25T00:00:00Z')
    } as never);

    const result = await createAdminPoi(
      {
        name: { vi: 'Phở Thìn' },
        description: { vi: 'Nổi tiếng' },
        latitude: '21.01',
        longitude: 105.85,
        type: 'FOOD'
      },
      { actor: 'admin-1', source: 'test' }
    );

    expect(result.id).toBe('poi-1');
    expect(prisma.pointOfInterest.create).toHaveBeenCalledTimes(1);
    expect(vi.mocked(prisma.pointOfInterest.create).mock.calls[0]?.[0]).toMatchObject({
      data: {
        name: { vi: 'Phở Thìn' },
        description: { vi: 'Nổi tiếng' },
        audioUrls: {},
        latitude: 21.01,
        longitude: 105.85,
        type: 'FOOD',
        image: null
      }
    });

    const { recordAdminAuditEvent } = await import('../src/services/adminAuditService');
    expect(recordAdminAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'poi.create',
        entity: 'poi',
        entityId: 'poi-1'
      })
    );
  });

  it('createAdminPoi should reject mismatched language sets between name and description', async () => {
    await expect(
      createAdminPoi(
        {
          name: { vi: 'Phở Thìn', en: 'Pho Thin' },
          description: { vi: 'Nổi tiếng' },
          latitude: 21.01,
          longitude: 105.85,
          type: 'FOOD'
        },
        { actor: 'admin-1', source: 'test' }
      )
    ).rejects.toThrow('name và description phải có cùng tập ngôn ngữ.');
  });

  it('createAdminPoi should reject audioUrls outside localized text languages', async () => {
    await expect(
      createAdminPoi(
        {
          name: { vi: 'Phở Thìn' },
          description: { vi: 'Nổi tiếng' },
          audioUrls: { en: '/audio/poi-en.mp3' },
          latitude: 21.01,
          longitude: 105.85,
          type: 'FOOD'
        },
        { actor: 'admin-1', source: 'test' }
      )
    ).rejects.toThrow('audioUrls phải khớp toàn bộ ngôn ngữ của name/description.');
  });

  it('listAdminPois should filter deleted POIs', async () => {
    vi.mocked(prisma.pointOfInterest.findMany).mockResolvedValue([
      {
        id: 'poi-1',
        name: { vi: 'Phở Thìn' },
        description: { vi: 'Nổi tiếng' },
        audioUrls: {},
        latitude: 21.01,
        longitude: 105.85,
        type: 'FOOD',
        image: null,
        isPublished: false,
        publishedAt: null,
        deletedAt: null,
        contentVersion: 1,
        createdAt: new Date('2026-03-25T00:00:00Z'),
        updatedAt: new Date('2026-03-25T00:00:00Z')
      } as never
    ]);

    const result = await listAdminPois({ actorId: 'admin-1', role: 'ADMIN' });

    expect(result).toHaveLength(1);
    expect(prisma.pointOfInterest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null }
      })
    );
  });

  it('updateAdminPoi should merge input and increment content version', async () => {
    vi.mocked(prisma.pointOfInterest.findFirst).mockResolvedValue({
      id: 'poi-1',
      name: { vi: 'Phở Thìn' },
      description: { vi: 'Nổi tiếng' },
      audioUrls: {},
      latitude: 21.01,
      longitude: 105.85,
      type: 'FOOD',
      image: null
    } as never);
    vi.mocked(prisma.pointOfInterest.update).mockResolvedValue({
      id: 'poi-1',
      name: { vi: 'Phở Thìn mới' },
      description: { vi: 'Nổi tiếng' },
      audioUrls: {},
      latitude: 21.02,
      longitude: 105.86,
      type: 'FOOD',
      image: null,
      isPublished: false,
      publishedAt: null,
      deletedAt: null,
      contentVersion: 2,
      createdAt: new Date('2026-03-25T00:00:00Z'),
      updatedAt: new Date('2026-03-26T00:00:00Z')
    } as never);

    const result = await updateAdminPoi(
      'poi-1',
      {
        name: { vi: 'Phở Thìn mới' },
        latitude: 21.02,
        longitude: 105.86
      },
      { actorId: 'admin-1', role: 'ADMIN' }
    );

    expect(result.contentVersion).toBe(2);
    expect(prisma.pointOfInterest.update).toHaveBeenCalledTimes(1);
    expect(vi.mocked(prisma.pointOfInterest.update).mock.calls[0]?.[0]).toMatchObject({
      where: { id: 'poi-1' },
      data: {
        name: { vi: 'Phở Thìn mới' },
        latitude: 21.02,
        longitude: 105.86,
        contentVersion: {
          increment: 1
        }
      }
    });
  });

  it('updateAdminPoi should reject PARTNER attempting to update POI created by another user', async () => {
    vi.mocked(prisma.pointOfInterest.findFirst).mockResolvedValue({
      id: 'poi-1',
      creatorId: 'another-partner',
      name: { vi: 'Phở Thìn' },
      description: { vi: 'Nổi tiếng' },
      audioUrls: {},
      latitude: 21.01,
      longitude: 105.85,
      type: 'FOOD',
      image: null
    } as never);

    await expect(
      updateAdminPoi(
        'poi-1',
        { name: { vi: 'Phở Thìn mới' } },
        { actorId: 'partner-1', role: 'PARTNER' }
      )
    ).rejects.toThrow('Không có quyền sửa POI này.');
  });

  it('deleteAdminPoi should soft delete and increment version', async () => {
    vi.mocked(prisma.pointOfInterest.findFirst).mockResolvedValue({ id: 'poi-1' } as never);
    vi.mocked(prisma.tour.findMany).mockResolvedValue([
      {
        id: 'tour-1',
        poiIds: ['poi-1', 'poi-2']
      } as never,
      {
        id: 'tour-2',
        poiIds: ['poi-3']
      } as never
    ]);
    vi.mocked(prisma.pointOfInterest.update).mockResolvedValue({
      id: 'poi-1',
      name: { vi: 'Phở Thìn' },
      description: { vi: 'Nổi tiếng' },
      audioUrls: {},
      latitude: 21.01,
      longitude: 105.85,
      type: 'FOOD',
      image: null,
      isPublished: false,
      publishedAt: null,
      deletedAt: new Date('2026-03-26T00:00:00Z'),
      contentVersion: 2,
      createdAt: new Date('2026-03-25T00:00:00Z'),
      updatedAt: new Date('2026-03-26T00:00:00Z')
    } as never);
    vi.mocked(prisma.appSetting.findUnique).mockResolvedValue({ currentVersion: 10 } as never);
    vi.mocked(prisma.appSetting.update).mockResolvedValue({ currentVersion: 11 } as never);

    const result = await deleteAdminPoi('poi-1', { actorId: 'admin-1', role: 'ADMIN' });

    expect(result.deletedAt).toContain('2026-03-26');
    expect(prisma.tour.update).toHaveBeenCalledTimes(1);
    expect(vi.mocked(prisma.tour.update).mock.calls[0]?.[0]).toMatchObject({
      where: { id: 'tour-1' },
      data: {
        poiIds: ['poi-2'],
        contentVersion: {
          increment: 1
        }
      }
    });
    expect(prisma.pointOfInterest.update).toHaveBeenCalledTimes(1);
    expect(vi.mocked(prisma.appSetting.update)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(prisma.pointOfInterest.update).mock.calls[0]?.[0]).toMatchObject({
      where: { id: 'poi-1' },
      data: {
        deletedAt: expect.any(Date),
        isPublished: false,
        publishedAt: null,
        contentVersion: {
          increment: 1
        }
      }
    });
    const { cleanupPoiAudioFiles } = await import('../src/services/ttsService');
    expect(cleanupPoiAudioFiles).toHaveBeenCalledWith('poi-1');

    const { recordAdminAuditEvent } = await import('../src/services/adminAuditService');
    expect(recordAdminAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'poi.soft_delete',
        entity: 'poi',
        entityId: 'poi-1'
      })
    );
  });

  it('deleteAdminPoi should reject PARTNER attempting to delete POI created by another user', async () => {
    vi.mocked(prisma.pointOfInterest.findFirst).mockResolvedValue({
      id: 'poi-1',
      creatorId: 'another-partner',
      name: { vi: 'Phở Thìn' },
      description: { vi: 'Nổi tiếng' },
      audioUrls: {},
      latitude: 21.01,
      longitude: 105.85,
      type: 'FOOD',
      image: null
    } as never);

    await expect(
      deleteAdminPoi('poi-1', { actorId: 'partner-1', role: 'PARTNER' })
    ).rejects.toThrow('Không có quyền xóa POI này.');
  });

  it('publishAdminPoi should mark POI published and bump sync version', async () => {
    vi.mocked(prisma.pointOfInterest.findFirst).mockResolvedValue({ id: 'poi-1' } as never);
    vi.mocked(prisma.pointOfInterest.update).mockResolvedValue({
      id: 'poi-1',
      name: { vi: 'Phở Thìn' },
      description: { vi: 'Nổi tiếng' },
      audioUrls: {},
      latitude: 21.01,
      longitude: 105.85,
      type: 'FOOD',
      image: null,
      isPublished: true,
      publishedAt: new Date('2026-03-26T00:00:00Z'),
      deletedAt: null,
      contentVersion: 1,
      createdAt: new Date('2026-03-25T00:00:00Z'),
      updatedAt: new Date('2026-03-26T00:00:00Z')
    } as never);
    vi.mocked(prisma.appSetting.findUnique).mockResolvedValue({ currentVersion: 10 } as never);
    vi.mocked(prisma.appSetting.update).mockResolvedValue({ currentVersion: 11 } as never);

    const { publishAdminPoi } = await import('../src/services/poiAdminService');
    const result = await publishAdminPoi('poi-1', { actor: 'admin-1', source: 'test' });

    expect(result.isPublished).toBe(true);
    expect(result.syncVersion).toBe(11);
    expect(prisma.pointOfInterest.update).toHaveBeenCalledTimes(1);
    expect(vi.mocked(prisma.pointOfInterest.update).mock.calls[0]?.[0]).toMatchObject({
      where: { id: 'poi-1' },
      data: {
        isPublished: true,
        publishedAt: expect.any(Date)
      }
    });

    const { recordAdminAuditEvent } = await import('../src/services/adminAuditService');
    expect(recordAdminAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'poi.publish',
        entity: 'poi',
        entityId: 'poi-1'
      })
    );
  });

  it('purgeSoftDeletedPois should hard-delete items older than retention and cleanup artifacts', async () => {
    const originalRetention = process.env.POI_SOFT_DELETE_RETENTION_DAYS;
    process.env.POI_SOFT_DELETE_RETENTION_DAYS = '30';

    vi.mocked(prisma.pointOfInterest.findMany).mockResolvedValue([
      {
        id: 'poi-old-1',
        image: 'https://res.cloudinary.com/demo/image/upload/v1/phoamthuc/pois/poi-old-1.jpg'
      } as never,
      {
        id: 'poi-old-2',
        image: null
      } as never
    ]);
    vi.mocked(prisma.pointOfInterest.deleteMany).mockResolvedValue({ count: 2 } as never);

    const result = await purgeSoftDeletedPois({
      dryRun: false,
      now: new Date('2026-04-01T00:00:00.000Z'),
      context: {
        actor: 'qa-admin',
        reason: 'retention policy',
        source: 'api'
      }
    });

    expect(result.purged).toBe(2);
    expect(result.deletedIds).toEqual(['poi-old-1', 'poi-old-2']);
    expect(prisma.pointOfInterest.deleteMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ['poi-old-1', 'poi-old-2']
        }
      }
    });

    const { cleanupPoiAudioFiles } = await import('../src/services/ttsService');
    expect(cleanupPoiAudioFiles).toHaveBeenCalledWith('poi-old-1');
    expect(cleanupPoiAudioFiles).toHaveBeenCalledWith('poi-old-2');

    const { removeCloudinaryImageByUrl } = await import('../src/services/imageService');
    expect(removeCloudinaryImageByUrl).toHaveBeenCalledTimes(1);

    const { recordAdminAuditEvent } = await import('../src/services/adminAuditService');
    expect(recordAdminAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'poi.retention_purge',
        entity: 'system'
      })
    );

    if (originalRetention === undefined) {
      delete process.env.POI_SOFT_DELETE_RETENTION_DAYS;
    } else {
      process.env.POI_SOFT_DELETE_RETENTION_DAYS = originalRetention;
    }
  });

  it('invalidateSyncManifest should bump sync version', async () => {
    vi.mocked(prisma.appSetting.findUnique).mockResolvedValue({ currentVersion: 3 } as never);
    vi.mocked(prisma.appSetting.update).mockResolvedValue({ currentVersion: 4 } as never);

    const { invalidateSyncManifest } = await import('../src/services/poiAdminService');
    const result = await invalidateSyncManifest();

    expect(result.invalidated).toBe(true);
    expect(result.syncVersion).toBe(4);
    expect(prisma.appSetting.update).toHaveBeenCalledTimes(1);
  });
});
