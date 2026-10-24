-- Match Prisma relation actions while preserving delivery/audit records on delete.
ALTER TABLE "rider_profiles" DROP CONSTRAINT "rider_profiles_user_id_fkey",
 ADD CONSTRAINT "rider_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "delivery_assignments" DROP CONSTRAINT "delivery_assignments_transaction_id_fkey",
 ADD CONSTRAINT "delivery_assignments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 DROP CONSTRAINT "delivery_assignments_rider_id_fkey",
 ADD CONSTRAINT "delivery_assignments_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_events" DROP CONSTRAINT "order_events_transaction_id_fkey",
 ADD CONSTRAINT "order_events_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 DROP CONSTRAINT "order_events_actor_id_fkey",
 ADD CONSTRAINT "order_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
