ALTER TABLE "shop_services" ADD COLUMN "package_kilos" DECIMAL(10,2);

ALTER TABLE "shop_services" ADD CONSTRAINT "shop_services_package_kilos_positive"
CHECK ("package_kilos" IS NULL OR "package_kilos" > 0);
