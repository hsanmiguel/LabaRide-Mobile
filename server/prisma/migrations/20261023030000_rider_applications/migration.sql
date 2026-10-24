ALTER TABLE "rider_profiles"
 ADD COLUMN "application_status" TEXT NOT NULL DEFAULT 'Approved',
 ADD COLUMN "review_reason" TEXT,
 ADD COLUMN "reviewed_at" TIMESTAMP(3),
 ADD COLUMN "reviewed_by_id" INTEGER;
UPDATE "rider_profiles" SET "application_status" = 'Disabled' WHERE NOT "active";
