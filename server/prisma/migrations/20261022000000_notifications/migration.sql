CREATE TABLE "notifications" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "transaction_id" INTEGER NOT NULL,
  "shop_mode" BOOLEAN NOT NULL DEFAULT false,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "read_at" TIMESTAMP(3)
);
CREATE INDEX "notifications_user_id_shop_mode_created_at_idx" ON "notifications"("user_id", "shop_mode", "created_at");
