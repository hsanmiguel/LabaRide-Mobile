ALTER TYPE "TransactionStatus" ADD VALUE IF NOT EXISTS 'Accepted';
ALTER TYPE "TransactionStatus" ADD VALUE IF NOT EXISTS 'Queued';
ALTER TYPE "TransactionStatus" ADD VALUE IF NOT EXISTS 'Ready';
ALTER TABLE "transactions"
ADD COLUMN "requested_pickup_at" TIMESTAMPTZ(3),
ADD COLUMN "confirmed_pickup_at" TIMESTAMPTZ(3),
ADD COLUMN "received_at" TIMESTAMPTZ(3),
ADD COLUMN "processing_started_at" TIMESTAMPTZ(3),
ADD COLUMN "estimated_ready_at" TIMESTAMPTZ(3),
ADD COLUMN "estimate_updated_at" TIMESTAMPTZ(3),
ADD COLUMN "estimate_reason" TEXT,
ADD COLUMN "ready_at" TIMESTAMPTZ(3),
ADD COLUMN "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "transactions" SET "updated_at" = "created_at";
