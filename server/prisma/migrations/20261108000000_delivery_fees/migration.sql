CREATE TABLE "delivery_fee_settings" (
 "id" INTEGER PRIMARY KEY DEFAULT 1,
 "base_fee" DECIMAL(10,2) NOT NULL,
 "rate_per_km" DECIMAL(10,2) NOT NULL,
 "minimum_fee" DECIMAL(10,2) NOT NULL,
 "commission_percent" DECIMAL(5,2) NOT NULL,
 "revision" INTEGER NOT NULL DEFAULT 1,
 "updated_by" INTEGER NOT NULL,
 "updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "fee_settings_valid" CHECK (id = 1 AND base_fee >= 0 AND rate_per_km >= 0 AND minimum_fee >= 0 AND commission_percent BETWEEN 0 AND 100)
);
CREATE TABLE "delivery_fee_quotes" (
 "id" TEXT PRIMARY KEY, "user_id" INTEGER NOT NULL, "fingerprint" TEXT NOT NULL,
 "pricing" JSONB NOT NULL, "expires_at" TIMESTAMP(3) NOT NULL,
 "used_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "delivery_fee_quotes_user_id_expires_at_idx" ON "delivery_fee_quotes" ("user_id", "expires_at");
ALTER TABLE "transactions" ADD COLUMN "delivery_pricing" JSONB;
