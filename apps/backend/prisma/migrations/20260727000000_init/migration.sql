-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('DRAFT', 'UPCOMING', 'QUALIFICATION', 'PLAYOFF', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DivisionType" AS ENUM ('BEGINNER', 'EXPERIENCED', 'PRO');

-- CreateEnum
CREATE TYPE "QualificationResultStatus" AS ENUM ('COMPLETED', 'DNF', 'MISSED');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'APPLIED', 'FAILED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "PlayoffMatchKind" AS ENUM ('MAIN', 'THIRD_PLACE');

-- CreateEnum
CREATE TYPE "PlayoffMatchStatus" AS ENUM ('EMPTY', 'READY', 'COMPLETED');

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" UUID NOT NULL,
    "username" VARCHAR(64) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "passwordChangedAt" TIMESTAMPTZ(3) NOT NULL,
    "lastLoginAt" TIMESTAMPTZ(3),
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(3),

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" UUID NOT NULL,
    "adminUserId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL,
    "ipHash" TEXT,
    "userAgent" VARCHAR(512),
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "TournamentStatus" NOT NULL,
    "coverObjectKey" TEXT,
    "coverUrl" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Division" (
    "id" UUID NOT NULL,
    "tournamentId" UUID NOT NULL,
    "type" "DivisionType" NOT NULL,
    "displayName" VARCHAR(32) NOT NULL,
    "timeLimitMs" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Division_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" UUID NOT NULL,
    "rankedUuid" CHAR(32) NOT NULL,
    "currentNickname" VARCHAR(32) NOT NULL,
    "nicknameLower" VARCHAR(32) NOT NULL,
    "lastRankedSyncAt" TIMESTAMPTZ(3) NOT NULL,
    "rankedProfileSnapshot" JSONB NOT NULL,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentRegistration" (
    "id" UUID NOT NULL,
    "tournamentId" UUID NOT NULL,
    "divisionId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "nicknameSnapshot" VARCHAR(32) NOT NULL,
    "qualificationPoints" INTEGER NOT NULL DEFAULT 0,
    "averageTimeMs" INTEGER,
    "playedMatches" INTEGER NOT NULL DEFAULT 0,
    "dnfCount" INTEGER NOT NULL DEFAULT 0,
    "missedCount" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "TournamentRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualificationMatch" (
    "id" UUID NOT NULL,
    "divisionId" UUID NOT NULL,
    "matchNumber" INTEGER NOT NULL,
    "rankedMatchId" VARCHAR(32) NOT NULL,
    "rankedPlayedAt" TIMESTAMPTZ(3),
    "winnerRegistrationId" UUID,
    "activeImportId" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "QualificationMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualificationMatchImport" (
    "id" UUID NOT NULL,
    "qualificationMatchId" UUID NOT NULL,
    "importVersion" INTEGER NOT NULL,
    "status" "ImportStatus" NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "payloadHash" CHAR(64) NOT NULL,
    "rankedFetchedAt" TIMESTAMPTZ(3) NOT NULL,
    "initiatedByAdminId" UUID NOT NULL,
    "correctionReason" TEXT,
    "errorCode" VARCHAR(100),
    "errorMessage" TEXT,
    "appliedAt" TIMESTAMPTZ(3),

    CONSTRAINT "QualificationMatchImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualificationResult" (
    "id" UUID NOT NULL,
    "qualificationMatchId" UUID NOT NULL,
    "registrationId" UUID NOT NULL,
    "importId" UUID NOT NULL,
    "status" "QualificationResultStatus" NOT NULL,
    "placement" INTEGER,
    "rawTimeMs" INTEGER,
    "effectiveTimeMs" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "lastPhase" VARCHAR(100),
    "timeline" JSONB NOT NULL,

    CONSTRAINT "QualificationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayoffBracket" (
    "id" UUID NOT NULL,
    "divisionId" UUID NOT NULL,
    "size" INTEGER NOT NULL,
    "showThirdPlace" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PlayoffBracket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayoffSeed" (
    "id" UUID NOT NULL,
    "bracketId" UUID NOT NULL,
    "seedNumber" INTEGER NOT NULL,
    "registrationId" UUID,

    CONSTRAINT "PlayoffSeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayoffMatch" (
    "id" UUID NOT NULL,
    "bracketId" UUID NOT NULL,
    "kind" "PlayoffMatchKind" NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "participant1RegistrationId" UUID,
    "participant2RegistrationId" UUID,
    "score1" INTEGER,
    "score2" INTEGER,
    "winnerRegistrationId" UUID,
    "status" "PlayoffMatchStatus" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PlayoffMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "adminUserId" UUID NOT NULL,
    "action" VARCHAR(120) NOT NULL,
    "entityType" VARCHAR(120) NOT NULL,
    "entityId" VARCHAR(140) NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "requestId" VARCHAR(100) NOT NULL,
    "ipHash" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

-- CreateIndex
CREATE INDEX "AdminUser_username_idx" ON "AdminUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminSession_adminUserId_expiresAt_idx" ON "AdminSession"("adminUserId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tournament_slug_key" ON "Tournament"("slug");

-- CreateIndex
CREATE INDEX "Tournament_status_startsAt_idx" ON "Tournament"("status", "startsAt");

-- CreateIndex
CREATE INDEX "Tournament_endsAt_idx" ON "Tournament"("endsAt");

-- CreateIndex
CREATE INDEX "Division_tournamentId_sortOrder_idx" ON "Division"("tournamentId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Division_tournamentId_type_key" ON "Division"("tournamentId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_rankedUuid_key" ON "Participant"("rankedUuid");

-- CreateIndex
CREATE INDEX "Participant_nicknameLower_idx" ON "Participant"("nicknameLower");

-- CreateIndex
CREATE INDEX "TournamentRegistration_divisionId_qualificationPoints_idx" ON "TournamentRegistration"("divisionId", "qualificationPoints");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentRegistration_tournamentId_participantId_key" ON "TournamentRegistration"("tournamentId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "QualificationMatch_rankedMatchId_key" ON "QualificationMatch"("rankedMatchId");

-- CreateIndex
CREATE UNIQUE INDEX "QualificationMatch_activeImportId_key" ON "QualificationMatch"("activeImportId");

-- CreateIndex
CREATE INDEX "QualificationMatch_divisionId_rankedPlayedAt_idx" ON "QualificationMatch"("divisionId", "rankedPlayedAt");

-- CreateIndex
CREATE UNIQUE INDEX "QualificationMatch_divisionId_matchNumber_key" ON "QualificationMatch"("divisionId", "matchNumber");

-- CreateIndex
CREATE INDEX "QualificationMatchImport_qualificationMatchId_status_idx" ON "QualificationMatchImport"("qualificationMatchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "QualificationMatchImport_qualificationMatchId_importVersion_key" ON "QualificationMatchImport"("qualificationMatchId", "importVersion");

-- CreateIndex
CREATE INDEX "QualificationResult_qualificationMatchId_importId_idx" ON "QualificationResult"("qualificationMatchId", "importId");

-- CreateIndex
CREATE INDEX "QualificationResult_registrationId_idx" ON "QualificationResult"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "QualificationResult_importId_registrationId_key" ON "QualificationResult"("importId", "registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayoffBracket_divisionId_key" ON "PlayoffBracket"("divisionId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayoffSeed_bracketId_seedNumber_key" ON "PlayoffSeed"("bracketId", "seedNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PlayoffSeed_bracketId_registrationId_key" ON "PlayoffSeed"("bracketId", "registrationId");

-- CreateIndex
CREATE INDEX "PlayoffMatch_bracketId_roundNumber_idx" ON "PlayoffMatch"("bracketId", "roundNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PlayoffMatch_bracketId_kind_roundNumber_position_key" ON "PlayoffMatch"("bracketId", "kind", "roundNumber", "position");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");

-- AddForeignKey
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Division" ADD CONSTRAINT "Division_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentRegistration" ADD CONSTRAINT "TournamentRegistration_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentRegistration" ADD CONSTRAINT "TournamentRegistration_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentRegistration" ADD CONSTRAINT "TournamentRegistration_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualificationMatch" ADD CONSTRAINT "QualificationMatch_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualificationMatch" ADD CONSTRAINT "QualificationMatch_winnerRegistrationId_fkey" FOREIGN KEY ("winnerRegistrationId") REFERENCES "TournamentRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualificationMatch" ADD CONSTRAINT "QualificationMatch_activeImportId_fkey" FOREIGN KEY ("activeImportId") REFERENCES "QualificationMatchImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualificationMatchImport" ADD CONSTRAINT "QualificationMatchImport_qualificationMatchId_fkey" FOREIGN KEY ("qualificationMatchId") REFERENCES "QualificationMatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualificationMatchImport" ADD CONSTRAINT "QualificationMatchImport_initiatedByAdminId_fkey" FOREIGN KEY ("initiatedByAdminId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualificationResult" ADD CONSTRAINT "QualificationResult_qualificationMatchId_fkey" FOREIGN KEY ("qualificationMatchId") REFERENCES "QualificationMatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualificationResult" ADD CONSTRAINT "QualificationResult_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "TournamentRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualificationResult" ADD CONSTRAINT "QualificationResult_importId_fkey" FOREIGN KEY ("importId") REFERENCES "QualificationMatchImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffBracket" ADD CONSTRAINT "PlayoffBracket_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffSeed" ADD CONSTRAINT "PlayoffSeed_bracketId_fkey" FOREIGN KEY ("bracketId") REFERENCES "PlayoffBracket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffSeed" ADD CONSTRAINT "PlayoffSeed_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "TournamentRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffMatch" ADD CONSTRAINT "PlayoffMatch_bracketId_fkey" FOREIGN KEY ("bracketId") REFERENCES "PlayoffBracket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffMatch" ADD CONSTRAINT "PlayoffMatch_participant1RegistrationId_fkey" FOREIGN KEY ("participant1RegistrationId") REFERENCES "TournamentRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffMatch" ADD CONSTRAINT "PlayoffMatch_participant2RegistrationId_fkey" FOREIGN KEY ("participant2RegistrationId") REFERENCES "TournamentRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffMatch" ADD CONSTRAINT "PlayoffMatch_winnerRegistrationId_fkey" FOREIGN KEY ("winnerRegistrationId") REFERENCES "TournamentRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
