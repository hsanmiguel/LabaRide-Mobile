CREATE TABLE "shop_photos" (
    "shop_id" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "shop_photos_pkey" PRIMARY KEY ("shop_id")
);

ALTER TABLE "shop_photos" ADD CONSTRAINT "shop_photos_shop_id_fkey"
FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
