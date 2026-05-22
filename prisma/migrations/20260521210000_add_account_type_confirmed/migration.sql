-- AlterTable
-- Adds the per-account "type reviewed by user" flag. New accounts default to
-- false (unreviewed); the post-sync account-type review workflow flips it true.
ALTER TABLE "Account" ADD COLUMN "typeConfirmed" BOOLEAN NOT NULL DEFAULT false;
