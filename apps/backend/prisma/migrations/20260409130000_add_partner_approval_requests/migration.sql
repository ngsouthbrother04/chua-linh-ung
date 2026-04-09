DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ApprovalEntityType') THEN
    CREATE TYPE "ApprovalEntityType" AS ENUM ('POI', 'TOUR');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ApprovalActionType') THEN
    CREATE TYPE "ApprovalActionType" AS ENUM ('CREATE', 'UPDATE', 'DELETE');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ApprovalStatus') THEN
    CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "partner_approval_requests" (
  "id" TEXT NOT NULL,
  "entity_type" "ApprovalEntityType" NOT NULL,
  "action_type" "ApprovalActionType" NOT NULL,
  "target_id" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "decision_note" TEXT,
  "requested_by" TEXT NOT NULL,
  "reviewed_by" TEXT,
  "result_snapshot" JSONB,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "partner_approval_requests_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'partner_approval_requests_requested_by_fkey'
  ) THEN
    ALTER TABLE "partner_approval_requests"
      ADD CONSTRAINT "partner_approval_requests_requested_by_fkey"
      FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'partner_approval_requests_reviewed_by_fkey'
  ) THEN
    ALTER TABLE "partner_approval_requests"
      ADD CONSTRAINT "partner_approval_requests_reviewed_by_fkey"
      FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_partner_approval_requests_status_created_at"
  ON "partner_approval_requests"("status", "created_at");

CREATE INDEX IF NOT EXISTS "idx_partner_approval_requests_entity_action"
  ON "partner_approval_requests"("entity_type", "action_type");

CREATE INDEX IF NOT EXISTS "idx_partner_approval_requests_requested_by"
  ON "partner_approval_requests"("requested_by");

CREATE INDEX IF NOT EXISTS "idx_partner_approval_requests_reviewed_by"
  ON "partner_approval_requests"("reviewed_by");
