-- Replace claim-code flow with payment-only flow and rename payment_transactions -> payments

-- Drop callback FK before table rename to avoid dependency issues.
ALTER TABLE IF EXISTS "payment_callback_events"
DROP CONSTRAINT IF EXISTS "payment_callback_events_transaction_id_fkey";

-- Rename table to match new Prisma model mapping.
ALTER TABLE IF EXISTS "payment_transactions" RENAME TO "payments";

-- Rename indexes to keep naming consistent with new table.
ALTER INDEX IF EXISTS "idx_payment_transactions_status" RENAME TO "idx_payments_status";
ALTER INDEX IF EXISTS "idx_payment_transactions_created_at" RENAME TO "idx_payments_created_at";
ALTER INDEX IF EXISTS "idx_payment_transactions_user_id" RENAME TO "idx_payments_user_id";
ALTER INDEX IF EXISTS "idx_payment_transactions_provider_transaction_id" RENAME TO "idx_payments_provider_transaction_id";

-- Remove claim-code foreign key/column from users.
ALTER TABLE IF EXISTS "users"
DROP CONSTRAINT IF EXISTS "users_claim_code_id_fkey";

DROP INDEX IF EXISTS "idx_users_claim_code_id";

ALTER TABLE IF EXISTS "users"
DROP COLUMN IF EXISTS "claim_code_id";

-- Remove claim code table completely.
DROP TABLE IF EXISTS "claim_codes";

-- Recreate callback FK pointing to renamed payments table.
ALTER TABLE IF EXISTS "payment_callback_events"
ADD CONSTRAINT "payment_callback_events_transaction_id_fkey"
FOREIGN KEY ("transaction_id") REFERENCES "payments"("transaction_id") ON DELETE CASCADE ON UPDATE CASCADE;
