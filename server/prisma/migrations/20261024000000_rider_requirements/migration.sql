ALTER TABLE "rider_profiles"
 ADD COLUMN "license_number" TEXT, ADD COLUMN "license_expiry" DATE,
 ADD COLUMN "motorcycle_make" TEXT, ADD COLUMN "motorcycle_model" TEXT,
 ADD COLUMN "motorcycle_year" INTEGER, ADD COLUMN "plate_number" TEXT,
 ADD COLUMN "registered_owner" BOOLEAN NOT NULL DEFAULT true,
 ADD COLUMN "requirements_version" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "rider_documents" (
 "id" SERIAL PRIMARY KEY, "user_id" INTEGER NOT NULL,
 "type" TEXT NOT NULL, "bytes" BYTEA NOT NULL, "status" TEXT NOT NULL DEFAULT 'Pending',
 "review_reason" TEXT, "reviewed_by_id" INTEGER, "reviewed_at" TIMESTAMP(3), "updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "rider_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "rider_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "rider_documents_user_id_type_key" ON "rider_documents"("user_id", "type");
