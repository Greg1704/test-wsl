-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CREDIT', 'DEBIT', 'TRANSFER', 'CASH');

-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "type" "CardType" NOT NULL DEFAULT 'CREDIT',
ALTER COLUMN "closingDay" DROP NOT NULL,
ALTER COLUMN "dueDay" DROP NOT NULL,
ALTER COLUMN "expirationDate" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Installment" ADD COLUMN     "paidFromSavings" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CREDIT',
ALTER COLUMN "cardId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "IncomeEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "validFrom" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncomeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingsBalance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "asOf" DATE NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavingsBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IncomeEntry_userId_currency_validFrom_idx" ON "IncomeEntry"("userId", "currency", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "SavingsBalance_userId_currency_key" ON "SavingsBalance"("userId", "currency");

-- CreateIndex
CREATE INDEX "Purchase_userId_paymentMethod_idx" ON "Purchase"("userId", "paymentMethod");

-- AddForeignKey
ALTER TABLE "IncomeEntry" ADD CONSTRAINT "IncomeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsBalance" ADD CONSTRAINT "SavingsBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
