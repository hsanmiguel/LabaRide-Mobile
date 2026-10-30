ALTER TABLE "transactions"
  ADD COLUMN "completed_at" TIMESTAMPTZ(3),
  ADD COLUMN "cancelled_at" TIMESTAMPTZ(3);

-- Only recover dates from actual closing transitions. updated_at is not proof
-- of completion, and older legacy orders may have no recorded closing event.
UPDATE "transactions" AS t
SET "completed_at" = e.closed_at AT TIME ZONE 'UTC'
FROM (
  SELECT transaction_id, MIN(created_at) AS closed_at FROM "order_events"
  WHERE to_status = 'Completed' AND from_status IS DISTINCT FROM 'Completed'
  GROUP BY transaction_id
) AS e
WHERE t.id = e.transaction_id AND (t.workflow_status = 'Completed' OR (t.workflow_status IS NULL AND t.status = 'Completed'));

UPDATE "transactions" AS t
SET "cancelled_at" = e.closed_at AT TIME ZONE 'UTC'
FROM (
  SELECT transaction_id, MIN(created_at) AS closed_at FROM "order_events"
  WHERE to_status = 'Cancelled' AND from_status IS DISTINCT FROM 'Cancelled'
  GROUP BY transaction_id
) AS e
WHERE t.id = e.transaction_id AND (t.workflow_status = 'Cancelled' OR (t.workflow_status IS NULL AND t.status = 'Cancelled'));

CREATE INDEX "transactions_shop_id_created_at_idx" ON "transactions"("shop_id", "created_at");
CREATE INDEX "transactions_shop_id_completed_at_idx" ON "transactions"("shop_id", "completed_at");
