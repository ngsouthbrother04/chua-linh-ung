import crypto from "crypto";
import { Prisma } from "../generated/prisma/client";
import prisma from "../lib/prisma";

export type PaymentPackageItem = {
  code: string;
  name: string;
  amount: number;
  currency: string;
  durationDays: number;
  poiQuota: number;
  description?: string;
  isActive: boolean;
  createdAt: string;
  createdBy?: string;
};

export type ActivePaymentPackageEntitlement = {
  packageCode: string;
  packageName: string;
  poiQuota: number;
  durationDays: number;
  validUntil: string;
  transactionId: string;
};

type PaymentPackageCreateInput = {
  name: string;
  amount: number;
  currency?: string;
  durationDays?: number;
  poiQuota: number;
  description?: string;
  isActive?: boolean;
  createdBy?: string;
};

type PaymentPackageUpdateInput = {
  name?: string;
  amount?: number;
  currency?: string;
  durationDays?: number;
  poiQuota?: number;
  description?: string;
  isActive?: boolean;
};

type RawRecord = Record<string, unknown>;

function asRecord(value: unknown): RawRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as RawRecord;
}

function normalizePackageItem(value: unknown): PaymentPackageItem | null {
  const item = asRecord(value);
  const name = typeof item.name === "string" ? item.name.trim() : "";
  const amount =
    typeof item.amount === "number"
      ? item.amount
      : typeof item.amount === "string"
        ? Number(item.amount)
        : NaN;
  const poiQuotaRaw =
    typeof item.poiQuota === "number"
      ? item.poiQuota
      : typeof item.poiQuota === "string"
        ? Number(item.poiQuota)
        : typeof item.maxPois === "number"
          ? item.maxPois
          : typeof item.maxPois === "string"
            ? Number(item.maxPois)
            : 0;
  const poiQuota =
    Number.isInteger(poiQuotaRaw) && poiQuotaRaw >= 0 ? poiQuotaRaw : 0;

  if (!name || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const currency =
    typeof item.currency === "string" && item.currency.trim()
      ? item.currency.trim().toUpperCase()
      : "VND";

  const durationRaw =
    typeof item.durationDays === "number"
      ? item.durationDays
      : typeof item.durationDays === "string"
        ? Number(item.durationDays)
        : 30;
  const durationDays =
    Number.isInteger(durationRaw) && durationRaw > 0 ? durationRaw : 30;

  const isActive =
    typeof item.isActive === "boolean"
      ? item.isActive
      : item.isActive === undefined
        ? true
        : Boolean(item.isActive);

  const createdAt =
    typeof item.createdAt === "string" && item.createdAt.trim()
      ? item.createdAt
      : new Date().toISOString();
  const createdBy =
    typeof item.createdBy === "string" && item.createdBy.trim()
      ? item.createdBy.trim()
      : undefined;
  const description =
    typeof item.description === "string" && item.description.trim()
      ? item.description.trim()
      : undefined;

  return {
    code: typeof item.code === "string" ? item.code.trim().toLowerCase() : "",
    name,
    amount,
    currency,
    durationDays,
    poiQuota,
    description,
    isActive,
    createdAt,
    createdBy,
  };
}

function sanitizeFeatures(value: unknown): RawRecord {
  return asRecord(value);
}

function normalizePaymentPackageRecord(item: {
  code: string;
  name: string;
  amount: number;
  currency: string;
  durationDays: number;
  poiQuota: number;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  createdBy: string | null;
}): PaymentPackageItem {
  return {
    code: item.code,
    name: item.name,
    amount: item.amount,
    currency: item.currency,
    durationDays: item.durationDays,
    poiQuota: item.poiQuota,
    description: item.description ?? undefined,
    isActive: item.isActive,
    createdAt: item.createdAt.toISOString(),
    createdBy: item.createdBy ?? undefined,
  };
}

function validateNewPackageInput(input: PaymentPackageCreateInput): {
  name: string;
  amount: number;
  currency: string;
  durationDays: number;
  poiQuota: number;
  description?: string;
  isActive: boolean;
} {
  const name = input.name?.trim();
  const amount = Number(input.amount);
  const currency =
    typeof input.currency === "string" && input.currency.trim()
      ? input.currency.trim().toUpperCase()
      : "VND";
  const durationDays =
    input.durationDays === undefined ? 30 : Number(input.durationDays);
  const poiQuota = Number(input.poiQuota);
  const isActive = input.isActive ?? true;
  const description =
    typeof input.description === "string" && input.description.trim()
      ? input.description.trim()
      : undefined;

  if (!name) {
    throw new Error("INVALID_PAYMENT_PACKAGE_NAME");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("INVALID_PAYMENT_PACKAGE_AMOUNT");
  }

  if (!Number.isInteger(durationDays) || durationDays <= 0) {
    throw new Error("INVALID_PAYMENT_PACKAGE_DURATION");
  }

  if (!Number.isInteger(poiQuota) || poiQuota <= 0) {
    throw new Error("INVALID_PAYMENT_PACKAGE_POI_QUOTA");
  }

  return {
    name,
    amount,
    currency,
    durationDays,
    poiQuota,
    description,
    isActive,
  };
}

function slugifyPackageName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function generatePackageCode(name: string): string {
  const base = slugifyPackageName(name) || "package";
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${base}-${suffix}`;
}

function readPaymentMetadata(value: unknown): RawRecord {
  return asRecord(value);
}

export async function listPaymentPackages(options?: {
  includeInactive?: boolean;
}): Promise<PaymentPackageItem[]> {
  const includeInactive = options?.includeInactive ?? false;

  const packages = await prisma.paymentPackage.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: [{ amount: "asc" }, { createdAt: "asc" }],
  });

  return packages.map((item) => normalizePaymentPackageRecord(item));
}

export async function createPaymentPackage(
  input: PaymentPackageCreateInput,
): Promise<PaymentPackageItem> {
  const payload = validateNewPackageInput(input);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generatePackageCode(payload.name);

    try {
      const created = await prisma.paymentPackage.create({
        data: {
          code,
          name: payload.name,
          amount: payload.amount,
          currency: payload.currency,
          durationDays: payload.durationDays,
          poiQuota: payload.poiQuota,
          description: payload.description,
          isActive: payload.isActive,
          createdBy: input.createdBy,
        },
      });

      return normalizePaymentPackageRecord(created);
    } catch (error) {
      const codeOrError =
        error instanceof Prisma.PrismaClientKnownRequestError
          ? error.code
          : "UNKNOWN";
      if (codeOrError !== "P2002") {
        throw error;
      }
    }
  }

  throw new Error("PAYMENT_PACKAGE_CODE_GENERATION_FAILED");
}

export async function getPaymentPackageByCode(
  packageCode: string,
): Promise<PaymentPackageItem> {
  const normalizedCode = packageCode.trim().toLowerCase();
  if (!normalizedCode) {
    throw new Error("INVALID_PAYMENT_PACKAGE_CODE");
  }

  const matched = await prisma.paymentPackage.findUnique({
    where: { code: normalizedCode },
  });
  if (!matched || !matched.isActive) {
    throw new Error("PAYMENT_PACKAGE_NOT_FOUND");
  }

  return normalizePaymentPackageRecord(matched);
}

export async function updatePaymentPackage(
  packageCode: string,
  input: PaymentPackageUpdateInput,
): Promise<PaymentPackageItem> {
  const normalizedCode = packageCode.trim().toLowerCase();
  if (!normalizedCode) {
    throw new Error("INVALID_PAYMENT_PACKAGE_CODE");
  }

  const existing = await prisma.paymentPackage.findUnique({
    where: { code: normalizedCode },
  });

  if (!existing) {
    throw new Error("PAYMENT_PACKAGE_NOT_FOUND");
  }

  const nextName =
    input.name !== undefined ? input.name.trim() : existing.name.trim();
  const nextAmount =
    input.amount !== undefined ? Number(input.amount) : existing.amount;
  const nextCurrency =
    input.currency !== undefined
      ? input.currency.trim().toUpperCase() || "VND"
      : existing.currency;
  const nextDurationDays =
    input.durationDays !== undefined
      ? Number(input.durationDays)
      : existing.durationDays;
  const nextPoiQuota =
    input.poiQuota !== undefined ? Number(input.poiQuota) : existing.poiQuota;
  const nextDescription =
    input.description !== undefined
      ? input.description.trim() || null
      : existing.description;
  const nextIsActive =
    input.isActive !== undefined ? Boolean(input.isActive) : existing.isActive;

  if (!nextName) {
    throw new Error("INVALID_PAYMENT_PACKAGE_NAME");
  }

  if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
    throw new Error("INVALID_PAYMENT_PACKAGE_AMOUNT");
  }

  if (!Number.isInteger(nextDurationDays) || nextDurationDays <= 0) {
    throw new Error("INVALID_PAYMENT_PACKAGE_DURATION");
  }

  if (!Number.isInteger(nextPoiQuota) || nextPoiQuota <= 0) {
    throw new Error("INVALID_PAYMENT_PACKAGE_POI_QUOTA");
  }

  const updated = await prisma.paymentPackage.update({
    where: { code: normalizedCode },
    data: {
      name: nextName,
      amount: nextAmount,
      currency: nextCurrency,
      durationDays: nextDurationDays,
      poiQuota: nextPoiQuota,
      description: nextDescription,
      isActive: nextIsActive,
    },
  });

  return normalizePaymentPackageRecord(updated);
}

export async function deletePaymentPackage(
  packageCode: string,
): Promise<PaymentPackageItem> {
  const normalizedCode = packageCode.trim().toLowerCase();
  if (!normalizedCode) {
    throw new Error("INVALID_PAYMENT_PACKAGE_CODE");
  }

  const existing = await prisma.paymentPackage.findUnique({
    where: { code: normalizedCode },
  });

  if (!existing) {
    throw new Error("PAYMENT_PACKAGE_NOT_FOUND");
  }

  const deleted = await prisma.paymentPackage.delete({
    where: { code: normalizedCode },
  });

  return normalizePaymentPackageRecord(deleted);
}

export async function getUserActivePaymentPackageEntitlement(
  userId: string,
  referenceTime: Date = new Date(),
): Promise<ActivePaymentPackageEntitlement | null> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    return null;
  }

  const payments = await prisma.payment.findMany({
    where: {
      userId: normalizedUserId,
      status: "SUCCEEDED",
    },
    orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
    select: {
      transactionId: true,
      completedAt: true,
      createdAt: true,
      metadata: true,
    },
    take: 50,
  });

  for (const payment of payments) {
    const metadata = readPaymentMetadata(payment.metadata);
    const packageCode =
      typeof metadata.packageCode === "string"
        ? metadata.packageCode.trim().toLowerCase()
        : "";
    const packageName =
      typeof metadata.packageName === "string"
        ? metadata.packageName.trim()
        : "";
    const poiQuota = Number(metadata.poiQuota);
    const durationDays = Number(metadata.durationDays);

    if (
      !packageCode ||
      !packageName ||
      !Number.isInteger(poiQuota) ||
      poiQuota <= 0 ||
      !Number.isInteger(durationDays) ||
      durationDays <= 0
    ) {
      continue;
    }

    const baseTime = payment.completedAt ?? payment.createdAt;
    const validUntil = new Date(
      baseTime.getTime() + durationDays * 24 * 60 * 60 * 1000,
    );
    if (referenceTime.getTime() > validUntil.getTime()) {
      continue;
    }

    return {
      transactionId: payment.transactionId,
      packageCode,
      packageName,
      poiQuota,
      durationDays,
      validUntil: validUntil.toISOString(),
    };
  }

  return null;
}
