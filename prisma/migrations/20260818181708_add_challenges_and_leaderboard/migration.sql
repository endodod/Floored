-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL,
    "date" TEXT,
    "objective" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "games" TEXT[],
    "scenarios" JSONB,
    "startBankroll" INTEGER NOT NULL,
    "betCap" INTEGER,
    "targetBankroll" INTEGER,
    "name" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "shareCode" TEXT NOT NULL,
    "createdByDeviceId" TEXT,
    "createdById" TEXT,
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardEntry" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "userId" TEXT,
    "displayName" TEXT,
    "score" INTEGER NOT NULL,
    "betsUsed" INTEGER NOT NULL,
    "endBankroll" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaderboardEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Challenge_shareCode_key" ON "Challenge"("shareCode");

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
