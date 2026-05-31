/*
  Warnings:

  - Added the required column `bank` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `expirationDate` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Made the column `last4` on table `Card` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "bank" TEXT NOT NULL,
ADD COLUMN     "expirationDate" DATE NOT NULL,
ALTER COLUMN "last4" SET NOT NULL;
