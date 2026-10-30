ALTER TABLE "transactions"
  ADD COLUMN "washing_started_at" TIMESTAMPTZ(3);

-- Only the managed workflow's explicit wash transition proves when washing
-- began. Original Processing orders must wait for the owner's Start button.
UPDATE "transactions" AS t
SET "washing_started_at" = e."started_at"
FROM (
  SELECT "transaction_id", MIN("created_at") AS "started_at"
  FROM "order_events"
  WHERE "action" = 'wash' AND "to_status" = 'Washing'
  GROUP BY "transaction_id"
) AS e
WHERE t."id" = e."transaction_id" AND t."workflow_status" IS NOT NULL;
