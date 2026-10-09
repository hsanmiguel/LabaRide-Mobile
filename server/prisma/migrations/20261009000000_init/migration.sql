-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('Pending', 'Processing', 'Completed', 'Cancelled');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "phone" TEXT,
    "birthdate" DATE,
    "gender" TEXT,
    "zone" TEXT,
    "street" TEXT,
    "barangay" TEXT,
    "building" TEXT,
    "is_shop_owner" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shops" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "shop_name" TEXT NOT NULL,
    "contact_number" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "barangay" TEXT NOT NULL,
    "building" TEXT,
    "opening_time" TEXT NOT NULL,
    "closing_time" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_services" (
    "id" SERIAL NOT NULL,
    "shop_id" INTEGER NOT NULL,
    "service_name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "color" TEXT,

    CONSTRAINT "shop_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kilo_prices" (
    "id" SERIAL NOT NULL,
    "shop_id" INTEGER NOT NULL,
    "min_kilo" DECIMAL(10,2) NOT NULL,
    "max_kilo" DECIMAL(10,2) NOT NULL,
    "price_per_kilo" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kilo_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "shop_id" INTEGER NOT NULL,
    "user_name" TEXT NOT NULL,
    "user_email" TEXT NOT NULL,
    "user_phone" TEXT,
    "service_name" TEXT NOT NULL,
    "kilo_amount" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "delivery_fee" DECIMAL(10,2) NOT NULL,
    "voucher_discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "delivery_type" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "barangay" TEXT NOT NULL,
    "building" TEXT NOT NULL,
    "scheduled_date" DATE NOT NULL,
    "scheduled_time" TIME NOT NULL,
    "payment_method" TEXT NOT NULL DEFAULT 'Cash on Delivery',
    "notes" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'Pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_items" (
    "id" SERIAL NOT NULL,
    "transaction_id" INTEGER NOT NULL,
    "item_name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "transaction_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_items" (
    "id" SERIAL NOT NULL,
    "shop_id" INTEGER NOT NULL,
    "item_name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "household_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clothing_types" (
    "id" SERIAL NOT NULL,
    "shop_id" INTEGER NOT NULL,
    "type_name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "clothing_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "shops_user_id_key" ON "shops"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "unique_range" ON "kilo_prices"("shop_id", "min_kilo", "max_kilo");

-- AddForeignKey
ALTER TABLE "shops" ADD CONSTRAINT "shops_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_services" ADD CONSTRAINT "shop_services_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kilo_prices" ADD CONSTRAINT "kilo_prices_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_items" ADD CONSTRAINT "household_items_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clothing_types" ADD CONSTRAINT "clothing_types_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- All app data is accessed through Express with the privileged backend role.
-- Block access through Supabase's public Data API, including password hashes.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shops" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shop_services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "kilo_prices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transaction_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "household_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clothing_types" ENABLE ROW LEVEL SECURITY;
