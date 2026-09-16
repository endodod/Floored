/*
  Warnings:

  - You are about to drop the column `createdByDeviceId` on the `Challenge` table. All the data in the column will be lost.
  - You are about to drop the column `deviceId` on the `LeaderboardEntry` table. All the data in the column will be lost.
  - Made the column `userId` on table `LeaderboardEntry` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Challenge" DROP COLUMN "createdByDeviceId";

-- AlterTable
ALTER TABLE "LeaderboardEntry" DROP COLUMN "deviceId",
ALTER COLUMN "userId" SET NOT NULL;
