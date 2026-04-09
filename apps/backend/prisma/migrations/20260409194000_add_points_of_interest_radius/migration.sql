ALTER TABLE "points_of_interest"
  ADD COLUMN IF NOT EXISTS "radius" INTEGER NOT NULL DEFAULT 50;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'points_of_interest_radius_check'
  ) THEN
    ALTER TABLE "points_of_interest"
      ADD CONSTRAINT "points_of_interest_radius_check" CHECK ("radius" >= 0);
  END IF;
END $$;
