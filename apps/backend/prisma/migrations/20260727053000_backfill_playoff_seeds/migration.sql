-- Existing brackets were created before qualification leaders were snapshotted.
-- Fill their seed positions with the same deterministic leaderboard order.
WITH ranked_registrations AS (
  SELECT
    bracket."id" AS "bracketId",
    registration."id" AS "registrationId",
    ROW_NUMBER() OVER (
      PARTITION BY bracket."id"
      ORDER BY
        registration."qualificationPoints" DESC,
        registration."averageTimeMs" ASC NULLS LAST,
        LOWER(registration."nicknameSnapshot") ASC,
        participant."rankedUuid" ASC
    ) AS "seedNumber",
    bracket."size" AS "bracketSize"
  FROM "PlayoffBracket" AS bracket
  JOIN "TournamentRegistration" AS registration
    ON registration."divisionId" = bracket."divisionId"
  JOIN "Participant" AS participant
    ON participant."id" = registration."participantId"
)
UPDATE "PlayoffSeed" AS seed
SET "registrationId" = ranked."registrationId"
FROM ranked_registrations AS ranked
WHERE seed."bracketId" = ranked."bracketId"
  AND seed."seedNumber" = ranked."seedNumber"
  AND ranked."seedNumber" <= ranked."bracketSize";
