ALTER TABLE "shops"
  ADD COLUMN "delivery_min_km" DECIMAL(7,2),
  ADD COLUMN "delivery_max_km" DECIMAL(7,2),
  ADD COLUMN "pickup_min_km" DECIMAL(7,2),
  ADD COLUMN "pickup_max_km" DECIMAL(7,2),
  ADD COLUMN "pickup_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD CONSTRAINT "delivery_distance_range" CHECK (
    ("delivery_min_km" IS NULL OR "delivery_min_km" >= 0) AND
    ("delivery_max_km" IS NULL OR "delivery_max_km" > 0) AND
    ("delivery_min_km" IS NULL OR "delivery_max_km" IS NULL OR "delivery_min_km" <= "delivery_max_km")
  ),
  ADD CONSTRAINT "pickup_distance_range" CHECK (
    ("pickup_min_km" IS NULL OR "pickup_min_km" >= 0) AND
    ("pickup_max_km" IS NULL OR "pickup_max_km" > 0) AND
    ("pickup_min_km" IS NULL OR "pickup_max_km" IS NULL OR "pickup_min_km" <= "pickup_max_km")
  );

ALTER TABLE "transactions"
  ADD COLUMN "collection_method" TEXT NOT NULL DEFAULT 'Dropoff',
  ADD COLUMN "collection_address" JSONB,
  ADD CONSTRAINT "collection_method_valid" CHECK ("collection_method" IN ('Dropoff', 'ShopPickup'));
