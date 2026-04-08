-- Persist user token revocation cutoff to survive process restarts.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "token_invalid_before" TIMESTAMP;

CREATE INDEX IF NOT EXISTS "idx_users_token_invalid_before" ON "users" ("token_invalid_before");
