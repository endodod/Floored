-- CreateTable
CREATE TABLE "CommunityChallenge" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "minBet" INTEGER NOT NULL,
    "games" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "tries" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityChallengeScore" (
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "best" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityChallengeScore_pkey" PRIMARY KEY ("challengeId","userId")
);

-- CreateIndex
CREATE INDEX "CommunityChallenge_createdAt_idx" ON "CommunityChallenge"("createdAt");

-- CreateIndex
CREATE INDEX "CommunityChallengeScore_challengeId_best_idx" ON "CommunityChallengeScore"("challengeId", "best");

-- AddForeignKey
ALTER TABLE "CommunityChallengeScore" ADD CONSTRAINT "CommunityChallengeScore_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "CommunityChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
