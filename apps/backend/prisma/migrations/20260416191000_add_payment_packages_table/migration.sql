-- Create dedicated table for payment packages
CREATE TABLE "payment_packages" (
	"id" TEXT NOT NULL,
	"code" VARCHAR(120) NOT NULL,
	"name" VARCHAR(255) NOT NULL,
	"amount" INTEGER NOT NULL,
	"currency" VARCHAR(10) NOT NULL DEFAULT 'VND',
	"duration_days" INTEGER NOT NULL DEFAULT 30,
	"poi_quota" INTEGER NOT NULL DEFAULT 1,
	"description" TEXT,
	"is_active" BOOLEAN NOT NULL DEFAULT true,
	"created_by" TEXT,
	"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

	CONSTRAINT "payment_packages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "idx_payment_packages_code" ON "payment_packages"("code");
CREATE INDEX "idx_payment_packages_is_active" ON "payment_packages"("is_active");
CREATE INDEX "idx_payment_packages_created_at" ON "payment_packages"("created_at");

-- Migrate existing payment packages from app_settings.features.paymentPackages
INSERT INTO "payment_packages" (
	"id",
	"code",
	"name",
	"amount",
	"currency",
	"duration_days",
	"poi_quota",
	"description",
	"is_active",
	"created_by",
	"created_at",
	"updated_at"
)
SELECT
	md5('payment-package:' || COALESCE(NULLIF(TRIM(pkg.value->>'code'), ''), NULLIF(TRIM(pkg.value->>'name'), ''), pkg.value::text)),
	COALESCE(
		NULLIF(TRIM(pkg.value->>'code'), ''),
		lower(regexp_replace(COALESCE(NULLIF(TRIM(pkg.value->>'name'), ''), 'package'), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(pkg.value::text), 1, 6)
	),
	pkg.value->>'name',
	COALESCE(NULLIF(pkg.value->>'amount', '')::int, 0),
	COALESCE(NULLIF(TRIM(pkg.value->>'currency'), ''), 'VND'),
	COALESCE(NULLIF(pkg.value->>'durationDays', '')::int, 30),
	COALESCE(NULLIF(pkg.value->>'poiQuota', '')::int, NULLIF(pkg.value->>'maxPois', '')::int, 1),
	NULLIF(pkg.value->>'description', ''),
	COALESCE(NULLIF(pkg.value->>'isActive', '')::boolean, true),
	NULLIF(pkg.value->>'createdBy', ''),
	COALESCE(NULLIF(pkg.value->>'createdAt', '')::timestamp, CURRENT_TIMESTAMP),
	CURRENT_TIMESTAMP
FROM "app_settings" settings
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(settings."features"->'paymentPackages', '[]'::jsonb)) AS pkg(value)
WHERE settings."id" = 1
  AND jsonb_typeof(settings."features"->'paymentPackages') = 'array';

-- Remove package definitions from app_settings now that they live in a dedicated table.
UPDATE "app_settings"
SET "features" = COALESCE("features", '{}'::jsonb) - 'paymentPackages'
WHERE "id" = 1
  AND "features" ? 'paymentPackages';