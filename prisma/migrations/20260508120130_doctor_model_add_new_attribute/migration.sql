/*
  Warnings:

  - A unique constraint covering the columns `[institutionalId]` on the table `doctors` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "doctors" ADD COLUMN     "institutionalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "doctors_institutionalId_key" ON "doctors"("institutionalId");
