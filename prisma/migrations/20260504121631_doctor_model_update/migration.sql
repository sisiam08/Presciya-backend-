/*
  Warnings:

  - You are about to drop the column `email` on the `doctors` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `doctors` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "doctors_email_key";

-- AlterTable
ALTER TABLE "doctors" DROP COLUMN "email",
DROP COLUMN "password";
