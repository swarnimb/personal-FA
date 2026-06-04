-- AlterTable
-- Adds the balance's effective time ("As of"), captured from the SimpleFin
-- `balance-date` field. Nullable & additive: existing rows stay NULL and the
-- Accounts page falls back to lastSyncedAt/updatedAt for the freshness line.
-- Accounts synced after this column exists populate it on their next sync.
ALTER TABLE "Account" ADD COLUMN "balanceAsOf" TIMESTAMP(3);
