/*
  Warnings:

  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Challenge" DROP CONSTRAINT "Challenge_createdById_fkey";

-- DropForeignKey
ALTER TABLE "LeaderboardEntry" DROP CONSTRAINT "LeaderboardEntry_userId_fkey";

-- DropForeignKey
ALTER TABLE "Run" DROP CONSTRAINT "Run_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserCosmetic" DROP CONSTRAINT "UserCosmetic_userId_fkey";

-- DropTable
DROP TABLE "User";
