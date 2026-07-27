-- Existing imported matches cannot be backfilled safely: the Ranked API exposes
-- actual completion entries, but not the configured completion target.
ALTER TABLE "QualificationMatch"
ADD COLUMN "completionLimit" INTEGER;

ALTER TABLE "QualificationMatchImport"
ADD COLUMN "completionLimit" INTEGER;

ALTER TABLE "QualificationMatch"
ADD CONSTRAINT "QualificationMatch_completionLimit_check"
CHECK ("completionLimit" IS NULL OR "completionLimit" IN (4, 6, 8, 10, 12));

ALTER TABLE "QualificationMatchImport"
ADD CONSTRAINT "QualificationMatchImport_completionLimit_check"
CHECK ("completionLimit" IS NULL OR "completionLimit" IN (4, 6, 8, 10, 12));
