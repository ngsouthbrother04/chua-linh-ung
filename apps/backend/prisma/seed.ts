/// <reference types="node" />
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { buildSeedDataset } from "../src/services/seedService";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = "admin@phoamthuc.local";
  const partnerEmail = "partner@phoamthuc.local";
  const sharedPassword = "123321az";
  const passwordHash = await bcrypt.hash(sharedPassword, 10);

  const dataset = buildSeedDataset(1, Date.now());
  const poiIds = dataset.pois.map((poi) => poi.id);
  const tourIds = dataset.tours.map((tour) => tour.id);

  await prisma.$transaction(async (tx) => {
    const adminUser = await tx.user.upsert({
      where: { email: adminEmail },
      update: {
        fullName: "System Admin",
        role: "ADMIN",
        isActive: true,
        passwordHash,
      },
      create: {
        email: adminEmail,
        fullName: "System Admin",
        role: "ADMIN",
        isActive: true,
        preferredLanguage: "vi",
        passwordHash,
      },
    });

    const partnerUser = await tx.user.upsert({
      where: { email: partnerEmail },
      update: {
        fullName: "Food Partner",
        role: "PARTNER",
        isActive: true,
        passwordHash,
      },
      create: {
        email: partnerEmail,
        fullName: "Food Partner",
        role: "PARTNER",
        isActive: true,
        preferredLanguage: "vi",
        passwordHash,
      },
    });

    await tx.analyticsEvent.deleteMany({
      where: {
        OR: [
          {
            poiId: {
              notIn: poiIds,
            },
          },
          {
            sessionId: {
              startsWith: "seed-session-",
            },
          },
        ],
      },
    });

    await tx.tour.deleteMany({
      where: {
        id: {
          notIn: tourIds,
        },
      },
    });

    await tx.pointOfInterest.deleteMany({
      where: {
        id: {
          notIn: poiIds,
        },
      },
    });

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
          isPublished: true,
          publishedAt: new Date(),
          creatorId: partnerUser.id,
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
          isPublished: true,
          publishedAt: new Date(),
          creatorId: partnerUser.id,
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
          isPublished: true,
          publishedAt: new Date(),
          creatorId: partnerUser.id,
          contentVersion: tour.contentVersion,
        },
        create: {
          id: tour.id,
          name: tour.name,
          description: tour.description,
          duration: tour.duration,
          poiIds: tour.poiIds,
          image: tour.image,
          isPublished: true,
          publishedAt: new Date(),
          creatorId: partnerUser.id,
          contentVersion: tour.contentVersion,
        },
      });
    }

    await tx.analyticsEvent.createMany({
      data: dataset.analyticsEvents,
    });

    void adminUser;
  });

  console.log("Seeded accounts:");
  console.log("ADMIN:", { email: adminEmail, password: sharedPassword });
  console.log("PARTNER:", { email: partnerEmail, password: sharedPassword });
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
