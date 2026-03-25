/// <reference types="node" />
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { buildSeedDataset } from "../src/services/seedService";

const prisma = new PrismaClient();

async function main() {
  const dataset = buildSeedDataset(1, Date.now());

  await prisma.$transaction(async (tx) => {
    for (const poi of dataset.pois) {
      await tx.pointOfInterest.upsert({
        where: { id: poi.id },
        update: {
          name: poi.name,
          description: poi.description,
          audioUrls: poi.audioUrls,
          latitude: poi.latitude,
          longitude: poi.longitude,
          type: poi.type,
          image: poi.image,
          contentVersion: poi.contentVersion,
        },
        create: {
          id: poi.id,
          name: poi.name,
          description: poi.description,
          audioUrls: poi.audioUrls,
          latitude: poi.latitude,
          longitude: poi.longitude,
          type: poi.type,
          image: poi.image,
          contentVersion: poi.contentVersion,
        },
      });
    }

    for (const tour of dataset.tours) {
      await tx.tour.upsert({
        where: { id: tour.id },
        update: {
          name: tour.name,
          description: tour.description,
          duration: tour.duration,
          poiIds: tour.poiIds,
          image: tour.image,
          contentVersion: tour.contentVersion,
        },
        create: {
          id: tour.id,
          name: tour.name,
          description: tour.description,
          duration: tour.duration,
          poiIds: tour.poiIds,
          image: tour.image,
          contentVersion: tour.contentVersion,
        },
      });
    }

    await tx.analyticsEvent.deleteMany({
      where: {
        sessionId: {
          startsWith: "seed-session-",
        },
      },
    });

    await tx.analyticsEvent.createMany({
      data: dataset.analyticsEvents,
    });
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Seed failed", error);
    await prisma.$disconnect();
    process.exit(1);
  });
