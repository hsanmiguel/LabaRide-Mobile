ALTER TABLE "transactions"
  ADD COLUMN "washing_minutes" INTEGER,
  ADD COLUMN "drying_minutes" INTEGER,
  ADD COLUMN "drying_started_at" TIMESTAMPTZ(3),
  ADD COLUMN "processing_timing_captured_at" TIMESTAMPTZ(3);
