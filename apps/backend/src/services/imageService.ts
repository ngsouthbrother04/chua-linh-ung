import { v2 as cloudinary } from 'cloudinary';
import prisma from '../lib/prisma';

export interface UploadPoiImageResult {
  poiId: string;
  imageUrl: string;
  contentVersion: number;
}

export interface UploadTourImageResult {
  tourId: string;
  imageUrl: string;
  contentVersion: number;
}

function getCloudinaryFolder(entity: 'poi' | 'tour'): string {
  if (entity === 'tour') {
    return process.env.CLOUDINARY_TOUR_FOLDER?.trim() || 'phoamthuc/tours';
  }

  return process.env.CLOUDINARY_POI_FOLDER?.trim() || 'phoamthuc/pois';
}

function getImageMaxWidth(): number {
  const raw = Number(process.env.CLOUDINARY_IMAGE_MAX_WIDTH ?? 1600);
  if (!Number.isFinite(raw) || raw <= 0) {
    return 1600;
  }

  return Math.floor(raw);
}

function ensureCloudinaryConfig(): void {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('CLOUDINARY_NOT_CONFIGURED');
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true
  });
}

function extractCloudinaryPublicId(imageUrl: string): string | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  if (!cloudName) {
    return null;
  }

  try {
    const parsed = new URL(imageUrl);
    const hostParts = parsed.hostname.split('.');
    if (hostParts.length < 3 || hostParts[0] !== 'res' || hostParts[1] !== 'cloudinary') {
      return null;
    }

    const path = parsed.pathname;
    const cloudSegment = `/${cloudName}/`;
    const cloudIndex = path.indexOf(cloudSegment);
    if (cloudIndex === -1) {
      return null;
    }

    const remainder = path.slice(cloudIndex + cloudSegment.length);
    const uploadIndex = remainder.indexOf('upload/');
    if (uploadIndex === -1) {
      return null;
    }

    let publicPath = remainder.slice(uploadIndex + 'upload/'.length);
    if (!publicPath) {
      return null;
    }

    if (publicPath.startsWith('v')) {
      const slashIndex = publicPath.indexOf('/');
      if (slashIndex === -1) {
        return null;
      }

      const versionChunk = publicPath.slice(0, slashIndex);
      if (/^v\d+$/.test(versionChunk)) {
        publicPath = publicPath.slice(slashIndex + 1);
      }
    }

    const withoutExt = publicPath.replace(/\.[^/.]+$/, '');
    return withoutExt || null;
  } catch {
    return null;
  }
}

async function cleanupOldCloudinaryImage(oldImageUrl: string | null | undefined, newImageUrl: string): Promise<void> {
  if (!oldImageUrl || oldImageUrl === newImageUrl) {
    return;
  }

  const oldPublicId = extractCloudinaryPublicId(oldImageUrl);
  if (!oldPublicId) {
    return;
  }

  try {
    await cloudinary.uploader.destroy(oldPublicId, {
      resource_type: 'image',
      invalidate: true
    });
  } catch (error) {
    console.warn('[Cloudinary] Failed to cleanup old image', {
      oldPublicId,
      error
    });
  }
}

function uploadImageBufferToCloudinary(
  entityId: string,
  entity: 'poi' | 'tour',
  file: Express.Multer.File
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const uploader = cloudinary.uploader.upload_stream(
      {
        folder: getCloudinaryFolder(entity),
        public_id: `${entityId}-${timestamp}`,
        resource_type: 'image',
        transformation: [
          {
            width: getImageMaxWidth(),
            crop: 'limit'
          },
          {
            fetch_format: 'auto',
            quality: 'auto'
          }
        ]
      },
      (error, result) => {
        if (error || !result?.secure_url) {
          reject(error ?? new Error('CLOUDINARY_UPLOAD_FAILED'));
          return;
        }

        resolve(result.secure_url);
      }
    );

    uploader.end(file.buffer);
  });
}

export async function uploadPoiImage(poiId: string, file: Express.Multer.File): Promise<UploadPoiImageResult> {
  ensureCloudinaryConfig();

  const poi = await prisma.pointOfInterest.findUnique({
    where: { id: poiId },
    select: { id: true, image: true }
  });

  if (!poi) {
    throw new Error('POI_NOT_FOUND');
  }

  const imageUrl = await uploadImageBufferToCloudinary(poiId, 'poi', file);
  const updatedPoi = await prisma.pointOfInterest.update({
    where: { id: poiId },
    data: {
      image: imageUrl,
      contentVersion: {
        increment: 1
      }
    },
    select: {
      id: true,
      image: true,
      contentVersion: true
    }
  });

  await cleanupOldCloudinaryImage(poi.image, updatedPoi.image ?? imageUrl);

  return {
    poiId: updatedPoi.id,
    imageUrl: updatedPoi.image ?? imageUrl,
    contentVersion: updatedPoi.contentVersion
  };
}

export async function uploadTourImage(tourId: string, file: Express.Multer.File): Promise<UploadTourImageResult> {
  ensureCloudinaryConfig();

  const tour = await prisma.tour.findUnique({
    where: { id: tourId },
    select: { id: true, image: true }
  });

  if (!tour) {
    throw new Error('TOUR_NOT_FOUND');
  }

  const imageUrl = await uploadImageBufferToCloudinary(tourId, 'tour', file);
  const updatedTour = await prisma.tour.update({
    where: { id: tourId },
    data: {
      image: imageUrl,
      contentVersion: {
        increment: 1
      }
    },
    select: {
      id: true,
      image: true,
      contentVersion: true
    }
  });

  await cleanupOldCloudinaryImage(tour.image, updatedTour.image ?? imageUrl);

  return {
    tourId: updatedTour.id,
    imageUrl: updatedTour.image ?? imageUrl,
    contentVersion: updatedTour.contentVersion
  };
}
