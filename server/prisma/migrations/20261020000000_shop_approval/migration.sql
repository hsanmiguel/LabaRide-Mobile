CREATE TYPE "ShopApprovalStatus" AS ENUM ('Pending', 'Approved', 'Rejected', 'Suspended');
ALTER TABLE "users" ADD COLUMN "is_admin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "shops"
  ADD COLUMN "approval_status" "ShopApprovalStatus" NOT NULL DEFAULT 'Pending',
  ADD COLUMN "application_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "review_reason" TEXT,
  ADD COLUMN "reviewed_at" TIMESTAMP(3),
  ADD COLUMN "reviewed_by_id" INTEGER;
ALTER TABLE "shops" ADD CONSTRAINT "shops_reviewed_by_id_fkey"
  FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "shops_approval_status_created_at_idx" ON "shops"("approval_status", "created_at");
-- Existing shops must also pass review before being listed or used.
UPDATE "users" SET "is_shop_owner" = false WHERE "is_shop_owner" = true;
