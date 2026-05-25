-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "aiEncryptedApiKey" TEXT,
    "aiIv" TEXT,
    "aiAuthTag" TEXT,
    "aiMonthlyCapCents" INTEGER NOT NULL DEFAULT 500,
    "aiConsentAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- Seed the singleton row. AppSettings is a single-row table (id always 'singleton');
-- application code reads/writes this one row. Seeding here guarantees the row exists
-- before any application start, so reads can be UPDATE-only with no upsert ceremony.
INSERT INTO "AppSettings" ("id", "updatedAt") VALUES ('singleton', CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING;
