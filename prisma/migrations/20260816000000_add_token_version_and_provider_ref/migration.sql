-- AlterTable
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "BalanceTransaction" ADD COLUMN "providerRef" TEXT;

-- CreateIndex
CREATE INDEX "BalanceTransaction_providerRef_idx" ON "BalanceTransaction"("providerRef");
