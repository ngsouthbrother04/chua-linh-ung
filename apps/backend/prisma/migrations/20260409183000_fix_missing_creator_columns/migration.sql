-- Ensure ownership columns exist for partner/admin workflow.
ALTER TABLE "points_of_interest"
  ADD COLUMN IF NOT EXISTS "creator_id" TEXT;

ALTER TABLE "tours"
  ADD COLUMN IF NOT EXISTS "creator_id" TEXT;

CREATE INDEX IF NOT EXISTS "idx_points_of_interest_creator_id"
  ON "points_of_interest" ("creator_id");

CREATE INDEX IF NOT EXISTS "idx_tours_creator_id"
  ON "tours" ("creator_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'points_of_interest_creator_id_fkey'
  ) THEN
    ALTER TABLE "points_of_interest"
      ADD CONSTRAINT "points_of_interest_creator_id_fkey"
      FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tours_creator_id_fkey'
  ) THEN
    ALTER TABLE "tours"
      ADD CONSTRAINT "tours_creator_id_fkey"
      FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
