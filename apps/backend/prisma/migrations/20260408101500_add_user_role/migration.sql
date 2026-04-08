-- Add role enum and role column for role-based authorization.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
    CREATE TYPE "UserRole" AS ENUM ('USER', 'PARTNER', 'ADMIN');
  END IF;
END $$;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'USER';

CREATE INDEX IF NOT EXISTS "idx_users_role" ON "users" ("role");

-- Backfill role from claim code type when available.
UPDATE "users" AS u
SET "role" = CASE
  WHEN cc."code_type" IN ('ADMIN', 'ADMIN_CODE') THEN 'ADMIN'::"UserRole"
  WHEN cc."code_type" IN ('PARTNER', 'PARTNER_CODE') THEN 'PARTNER'::"UserRole"
  ELSE 'USER'::"UserRole"
END
FROM "claim_codes" AS cc
WHERE u."claim_code_id" = cc."id";
