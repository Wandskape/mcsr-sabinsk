ALTER TABLE "QualificationMatchImport"
ADD COLUMN "seedType" VARCHAR(32),
ADD COLUMN "bastionType" VARCHAR(32);

-- Backfill from the immutable Ranked API response already stored for every
-- historical import. No additional external API requests are required.
UPDATE "QualificationMatchImport"
SET
  "seedType" = CASE
    UPPER(REPLACE(REPLACE("rawPayload" #>> '{data,seedType}', ' ', '_'), '-', '_'))
    WHEN 'BURIED_TREASURE' THEN 'BURIED_TREASURE'
    WHEN 'SHIPWRECK' THEN 'SHIPWRECK'
    WHEN 'VILLAGE' THEN 'VILLAGE'
    WHEN 'RUINED_PORTAL' THEN 'RUINED_PORTAL'
    WHEN 'DESERT_TEMPLE' THEN 'DESERT_TEMPLE'
    ELSE NULL
  END,
  "bastionType" = CASE
    UPPER(REPLACE(REPLACE("rawPayload" #>> '{data,bastionType}', ' ', '_'), '-', '_'))
    WHEN 'BRIDGE' THEN 'BRIDGE'
    WHEN 'HOUSING' THEN 'HOUSING'
    WHEN 'TREASURE' THEN 'TREASURE'
    WHEN 'STABLES' THEN 'STABLES'
    ELSE NULL
  END;

ALTER TABLE "QualificationMatchImport"
ADD CONSTRAINT "QualificationMatchImport_seedType_check"
CHECK (
  "seedType" IS NULL OR
  "seedType" IN (
    'BURIED_TREASURE',
    'SHIPWRECK',
    'VILLAGE',
    'RUINED_PORTAL',
    'DESERT_TEMPLE'
  )
),
ADD CONSTRAINT "QualificationMatchImport_bastionType_check"
CHECK (
  "bastionType" IS NULL OR
  "bastionType" IN ('BRIDGE', 'HOUSING', 'TREASURE', 'STABLES')
);
