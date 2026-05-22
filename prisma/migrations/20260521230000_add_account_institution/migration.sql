-- AlterTable
-- Adds the institution (bank) name captured from the SimpleFin `org` object.
-- Nullable: accounts synced before this column existed populate it on their
-- next sync.
ALTER TABLE "Account" ADD COLUMN "institution" TEXT;
