-- CreateEnum
CREATE TYPE "MerchantRuleSource" AS ENUM ('USER', 'AI');

-- CreateTable
CREATE TABLE "MerchantRule" (
    "normalizedMerchant" TEXT NOT NULL,
    "displayMerchant" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "source" "MerchantRuleSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantRule_pkey" PRIMARY KEY ("normalizedMerchant")
);
