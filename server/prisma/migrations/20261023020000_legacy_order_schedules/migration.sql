-- Preserve imported orders with missing schedules without inventing dates.
-- The booking API continues to require future date and time values.
ALTER TABLE "transactions" ALTER COLUMN "scheduled_date" DROP NOT NULL;
ALTER TABLE "transactions" ALTER COLUMN "scheduled_time" DROP NOT NULL;
