-- Persist the set of divisions that entered qualification.
ALTER TABLE "Division"
ADD COLUMN "isParticipating" BOOLEAN NOT NULL DEFAULT false;

-- Existing started tournaments passed the old rule that required registrations
-- in every division. Backfill from durable tournament data for compatibility.
UPDATE "Division" AS division
SET "isParticipating" = true
WHERE EXISTS (
  SELECT 1
  FROM "TournamentRegistration" AS registration
  WHERE registration."divisionId" = division."id"
)
OR EXISTS (
  SELECT 1
  FROM "QualificationMatch" AS match
  WHERE match."divisionId" = division."id"
)
OR EXISTS (
  SELECT 1
  FROM "PlayoffBracket" AS bracket
  WHERE bracket."divisionId" = division."id"
);
