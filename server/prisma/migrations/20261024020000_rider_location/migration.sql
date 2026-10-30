ALTER TABLE "delivery_assignments"
 ADD COLUMN "live_latitude" DOUBLE PRECISION,
 ADD COLUMN "live_longitude" DOUBLE PRECISION,
 ADD COLUMN "live_accuracy" DOUBLE PRECISION,
 ADD COLUMN "location_captured_at" TIMESTAMP(3),
 ADD COLUMN "location_received_at" TIMESTAMP(3),
 ADD COLUMN "location_sharing" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "location_session" TEXT;
