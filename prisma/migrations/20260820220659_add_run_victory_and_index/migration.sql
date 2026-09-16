-- AlterTable
ALTER TABLE "Run" ADD COLUMN     "victory" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Run_userId_idx" ON "Run"("userId");
