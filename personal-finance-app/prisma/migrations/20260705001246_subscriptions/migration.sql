-- CreateEnum
CREATE TYPE "SubMethod" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "ChargeStatus" AS ENUM ('PAID', 'SKIPPED');

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "paymentMethod" "SubMethod" NOT NULL,
    "cardId" TEXT,
    "firstChargeDate" DATE NOT NULL,
    "endDate" DATE,
    "categoryId" TEXT,
    "limitRate" DECIMAL(18,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionCharge" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "periodMonth" DATE NOT NULL,
    "status" "ChargeStatus" NOT NULL,
    "paidFromSavings" BOOLEAN NOT NULL DEFAULT true,
    "paidAt" TIMESTAMP(3),
    "amountCentsOverride" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_cardId_idx" ON "Subscription"("cardId");

-- CreateIndex
CREATE INDEX "SubscriptionCharge_subscriptionId_idx" ON "SubscriptionCharge"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionCharge_subscriptionId_periodMonth_key" ON "SubscriptionCharge"("subscriptionId", "periodMonth");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionCharge" ADD CONSTRAINT "SubscriptionCharge_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
