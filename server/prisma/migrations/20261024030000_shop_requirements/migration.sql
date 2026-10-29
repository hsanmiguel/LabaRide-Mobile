ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "requirements_version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "shops" ALTER COLUMN "requirements_version" SET DEFAULT 1;
UPDATE "shops" SET "requirements_version" = 1 WHERE "approval_status" IN ('Pending','Rejected');
CREATE TABLE IF NOT EXISTS "shop_documents" (
 "id" SERIAL PRIMARY KEY, "shop_id" INTEGER NOT NULL, "type" TEXT NOT NULL,
 "bytes" BYTEA NOT NULL, "status" TEXT NOT NULL DEFAULT 'Pending',
 "review_reason" TEXT, "reviewed_by_id" INTEGER, "reviewed_at" TIMESTAMP(3),
 "updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "shop_documents_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "shop_documents_shop_id_type_key" ON "shop_documents"("shop_id", "type");
