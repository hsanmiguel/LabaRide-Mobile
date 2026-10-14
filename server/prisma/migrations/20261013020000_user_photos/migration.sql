CREATE TABLE "user_photos" (
    "user_id" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_photos_pkey" PRIMARY KEY ("user_id")
);

ALTER TABLE "user_photos" ADD CONSTRAINT "user_photos_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
