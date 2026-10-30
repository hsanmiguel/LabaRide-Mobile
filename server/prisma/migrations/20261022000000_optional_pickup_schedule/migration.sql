-- Pickup orders do not require a customer-selected collection schedule.
ALTER TABLE "transactions"
  ALTER COLUMN "scheduled_date" DROP NOT NULL,
  ALTER COLUMN "scheduled_time" DROP NOT NULL;
