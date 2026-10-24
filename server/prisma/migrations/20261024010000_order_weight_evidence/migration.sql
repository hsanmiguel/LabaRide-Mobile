CREATE TABLE "order_weight_evidence" (
  "id" SERIAL PRIMARY KEY,
  "transaction_id" INTEGER NOT NULL,
  "actor_id" INTEGER NOT NULL,
  "kilos" DECIMAL(10,2) NOT NULL,
  "total_amount" DECIMAL(10,2) NOT NULL,
  "note" TEXT NOT NULL,
  "bytes" BYTEA NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_weight_evidence_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "order_weight_evidence_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "order_weight_evidence_transaction_id_created_at_idx" ON "order_weight_evidence"("transaction_id", "created_at");
