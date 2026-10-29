ALTER TABLE "users" ADD COLUMN "is_rider" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "transactions" ADD COLUMN "workflow_status" TEXT,
 ADD COLUMN "workflow_version" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "pickup_code" TEXT, ADD COLUMN "collection_code" TEXT, ADD COLUMN "delivery_code" TEXT;
ALTER TABLE "notifications" ADD COLUMN "audience" TEXT NOT NULL DEFAULT 'customer';
UPDATE "notifications" SET "audience" = 'partner' WHERE "shop_mode" = true;
CREATE TABLE "rider_profiles" (
 "user_id" INTEGER PRIMARY KEY REFERENCES "users"("id"), "active" BOOLEAN NOT NULL DEFAULT true,
 "online" BOOLEAN NOT NULL DEFAULT false, "latitude" DOUBLE PRECISION, "longitude" DOUBLE PRECISION,
 "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "delivery_assignments" (
 "id" SERIAL PRIMARY KEY, "transaction_id" INTEGER NOT NULL REFERENCES "transactions"("id"),
 "rider_id" INTEGER NOT NULL REFERENCES "users"("id"), "stage" TEXT NOT NULL, "resume_status" TEXT,
 "status" TEXT NOT NULL DEFAULT 'Offered', "expires_at" TIMESTAMP(3) NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "delivery_assignments_rider_id_status_idx" ON "delivery_assignments"("rider_id", "status");
CREATE INDEX "delivery_assignments_transaction_id_stage_status_idx" ON "delivery_assignments"("transaction_id", "stage", "status");
CREATE UNIQUE INDEX "delivery_assignments_one_active_stage" ON "delivery_assignments"("transaction_id", "stage") WHERE "status" IN ('Offered', 'Accepted');
CREATE TABLE "order_events" (
 "id" SERIAL PRIMARY KEY, "transaction_id" INTEGER NOT NULL REFERENCES "transactions"("id"),
 "actor_id" INTEGER NOT NULL REFERENCES "users"("id"), "action" TEXT NOT NULL,
 "from_status" TEXT, "to_status" TEXT NOT NULL, "detail" TEXT,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "order_events_transaction_id_created_at_idx" ON "order_events"("transaction_id", "created_at");
