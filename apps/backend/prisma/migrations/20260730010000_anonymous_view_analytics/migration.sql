CREATE TYPE "AnalyticsEventType" AS ENUM (
  'TOURNAMENT_VIEW',
  'PARTICIPANT_VIEW',
  'MATCH_VIEW'
);

CREATE TABLE "AnalyticsEvent" (
  "id" UUID NOT NULL,
  "eventType" "AnalyticsEventType" NOT NULL,
  "resourceId" UUID NOT NULL,
  "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalyticsDailyMetric" (
  "day" DATE NOT NULL,
  "eventType" "AnalyticsEventType" NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "AnalyticsDailyMetric_pkey" PRIMARY KEY ("day", "eventType")
);

CREATE INDEX "AnalyticsEvent_occurredAt_idx"
ON "AnalyticsEvent"("occurredAt");

CREATE INDEX "AnalyticsEvent_eventType_occurredAt_idx"
ON "AnalyticsEvent"("eventType", "occurredAt");

CREATE INDEX "AnalyticsDailyMetric_day_idx"
ON "AnalyticsDailyMetric"("day");
