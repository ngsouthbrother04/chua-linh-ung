import prisma from '../src/lib/prisma';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Readable } from 'stream';
import { v2 as cloudinary } from 'cloudinary';
import { uploadPoiImage, uploadTourImage } from '../src/services/imageService';

vi.mock('cloudinary', () => ({
  v2: {
    config: vi.fn(),
    uploader: {
      upload_stream: vi.fn(),
      destroy: vi.fn()
    }
  }
}));

vi.mock('../src/lib/prisma', () => ({
  default: {
    pointOfInterest: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    tour: {
      findUnique: vi.fn(),
      update: vi.fn()
    }
  }
}));

function createMockFile(mimetype = 'image/jpeg'): Express.Multer.File {
  const buffer = Buffer.from('fake');

  return {
    fieldname: 'image',
    originalname: 'demo.jpg',
    encoding: '7bit',
    mimetype,
    size: 4,
    destination: '',
    filename: 'demo.jpg',
    path: '',
    buffer,
    stream: Readable.from(buffer)
  };
}

describe('imageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLOUDINARY_CLOUD_NAME = 'demo-cloud';
    process.env.CLOUDINARY_API_KEY = 'demo-key';
    process.env.CLOUDINARY_API_SECRET = 'demo-secret';
  });

  it('uploadPoiImage should upload to cloudinary and update poi image', async () => {
    vi.mocked(prisma.pointOfInterest.findUnique).mockResolvedValue({
      id: 'poi-1',
      image: 'https://res.cloudinary.com/demo-cloud/image/upload/v1/phoamthuc/pois/old-poi.jpg'
    } as never);
    vi.mocked(prisma.pointOfInterest.update).mockResolvedValue({
      id: 'poi-1',
      image: 'https://res.cloudinary.com/demo/image/upload/v1/phoamthuc/pois/poi-1.jpg',
      contentVersion: 5
    } as never);
    vi.mocked(cloudinary.uploader.destroy).mockResolvedValue({ result: 'ok' } as never);

    const uploadStreamMock = cloudinary.uploader.upload_stream as unknown as {
      mockImplementation: (impl: (...args: unknown[]) => unknown) => void;
    };
    uploadStreamMock.mockImplementation((...args: unknown[]) => {
      const typedCallback = args[args.length - 1] as (error?: unknown, result?: { secure_url?: string }) => void;
      typedCallback(undefined, {
        secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/phoamthuc/pois/poi-1.jpg'
      });

      return {
        end: vi.fn()
      } as never;
    });

    const result = await uploadPoiImage('poi-1', createMockFile());

    expect(result.poiId).toBe('poi-1');
    expect(result.imageUrl).toContain('cloudinary.com');
    expect(result.contentVersion).toBe(5);
    expect(prisma.pointOfInterest.update).toHaveBeenCalledTimes(1);
    expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
      expect.objectContaining({
        transformation: [
          expect.objectContaining({ width: 1600, crop: 'limit' }),
          expect.objectContaining({ fetch_format: 'auto', quality: 'auto' })
        ]
      }),
      expect.any(Function)
    );
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('phoamthuc/pois/old-poi', {
      resource_type: 'image',
      invalidate: true
    });
  });

  it('uploadTourImage should upload to cloudinary and update tour image', async () => {
    vi.mocked(prisma.tour.findUnique).mockResolvedValue({
      id: 'tour-1',
      image: 'https://res.cloudinary.com/demo-cloud/image/upload/v42/phoamthuc/tours/old-tour.webp'
    } as never);
    vi.mocked(prisma.tour.update).mockResolvedValue({
      id: 'tour-1',
      image: 'https://res.cloudinary.com/demo/image/upload/v1/phoamthuc/tours/tour-1.jpg',
      contentVersion: 3
    } as never);
    vi.mocked(cloudinary.uploader.destroy).mockResolvedValue({ result: 'ok' } as never);

    const uploadStreamMock = cloudinary.uploader.upload_stream as unknown as {
      mockImplementation: (impl: (...args: unknown[]) => unknown) => void;
    };
    uploadStreamMock.mockImplementation((...args: unknown[]) => {
      const typedCallback = args[args.length - 1] as (error?: unknown, result?: { secure_url?: string }) => void;
      typedCallback(undefined, {
        secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/phoamthuc/tours/tour-1.jpg'
      });

      return {
        end: vi.fn()
      } as never;
    });

    const result = await uploadTourImage('tour-1', createMockFile());

    expect(result.tourId).toBe('tour-1');
    expect(result.imageUrl).toContain('cloudinary.com');
    expect(result.contentVersion).toBe(3);
    expect(prisma.tour.update).toHaveBeenCalledTimes(1);
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('phoamthuc/tours/old-tour', {
      resource_type: 'image',
      invalidate: true
    });
  });

  it('uploadPoiImage should throw CLOUDINARY_NOT_CONFIGURED when env is missing', async () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;

    await expect(uploadPoiImage('poi-1', createMockFile())).rejects.toThrow('CLOUDINARY_NOT_CONFIGURED');
  });
});
