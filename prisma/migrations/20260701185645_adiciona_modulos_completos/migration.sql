/*
  Warnings:

  - A unique constraint covering the columns `[stripeCustomerId]` on the table `Restaurante` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Restaurante" ADD COLUMN     "stripeCustomerId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Restaurante_stripeCustomerId_key" ON "Restaurante"("stripeCustomerId");
