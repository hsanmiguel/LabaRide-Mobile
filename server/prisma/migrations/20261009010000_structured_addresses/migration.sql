BEGIN;

CREATE TYPE "AddressType" AS ENUM ('Home', 'Work', 'Hotel', 'Apartment');

ALTER TABLE "users"
ADD COLUMN "access_code" TEXT,
ADD COLUMN "address_line_1" TEXT,
ADD COLUMN "address_line_2" TEXT,
ADD COLUMN "address_type" "AddressType",
ADD COLUMN "city" TEXT,
ADD COLUMN "country" TEXT,
ADD COLUMN "dropoff_instructions" TEXT,
ADD COLUMN "latitude" DECIMAL(10,7),
ADD COLUMN "longitude" DECIMAL(10,7),
ADD COLUMN "postal_code" TEXT,
ADD COLUMN "state_province" TEXT;

ALTER TABLE "shops"
ADD COLUMN "access_code" TEXT,
ADD COLUMN "address_line_1" TEXT,
ADD COLUMN "address_line_2" TEXT,
ADD COLUMN "address_type" "AddressType",
ADD COLUMN "city" TEXT,
ADD COLUMN "country" TEXT,
ADD COLUMN "dropoff_instructions" TEXT,
ADD COLUMN "postal_code" TEXT,
ADD COLUMN "state_province" TEXT,
ALTER COLUMN "zone" DROP NOT NULL,
ALTER COLUMN "street" DROP NOT NULL,
ALTER COLUMN "barangay" DROP NOT NULL,
ALTER COLUMN "latitude" SET DATA TYPE DECIMAL(10,7),
ALTER COLUMN "longitude" SET DATA TYPE DECIMAL(10,7);

ALTER TABLE "transactions"
ADD COLUMN "access_code" TEXT,
ADD COLUMN "address_line_1" TEXT,
ADD COLUMN "address_line_2" TEXT,
ADD COLUMN "address_type" "AddressType",
ADD COLUMN "city" TEXT,
ADD COLUMN "country" TEXT,
ADD COLUMN "dropoff_instructions" TEXT,
ADD COLUMN "latitude" DECIMAL(10,7),
ADD COLUMN "longitude" DECIMAL(10,7),
ADD COLUMN "postal_code" TEXT,
ADD COLUMN "state_province" TEXT,
ALTER COLUMN "zone" DROP NOT NULL,
ALTER COLUMN "street" DROP NOT NULL,
ALTER COLUMN "barangay" DROP NOT NULL,
ALTER COLUMN "building" DROP NOT NULL;

COMMIT;
