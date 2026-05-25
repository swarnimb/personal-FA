-- CreateTable
CREATE TABLE "LLMCost" (
    "yearMonth" TEXT NOT NULL,
    "estimatedCentsSpent" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LLMCost_pkey" PRIMARY KEY ("yearMonth")
);
