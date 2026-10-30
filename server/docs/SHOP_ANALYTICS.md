# Shop dashboard analytics

The shop dashboard reads `GET /api/shops/:shopId/analytics?start=YYYY-MM-DD&end=YYYY-MM-DD`.
Authentication and shop ownership are required. All dates use Asia/Manila.
Ranges include both selected days, accept at most 366 days, and cannot end in
the future. The endpoint defaults to the last 30 Philippine calendar days.

## Deployment

Apply migration `20261030000000_shop_analytics` before starting the updated
backend. From `server`, with the intended database environment configured:

```sh
npm run prisma:generate
npm run prisma:deploy
npm run build
```

Deploy the backend and then rebuild/redeploy the frontend. No new environment
variables or chart dependencies are needed. The migration has not been applied
to a remote database as part of the code change.

## Definitions

- Orders received: count by `createdAt`, including subsequently cancelled orders.
- Completed orders: currently completed orders with `completedAt` in the range.
- Completed order value: sum of their `totalAmount`, including delivery charges.
  The Revenue toggle uses this value; it is not a payment or cash-collection ledger.
- Laundry processed: sum of their recorded `kiloAmount`.
- Popular services: the five service names/combinations with the most completed
  orders in the range, then alphabetical order for ties. Each record shows count,
  kilograms and completed value. A combined service name remains one combination;
  one order is never counted once per individual service.
- Needs attention: current Pending, Queued and Ready orders across all dates,
  with detailed rider states mapped to the same groups as the Orders workspace.

One graph is rendered at a time. Orders/Revenue changes the metric, axis and
exact-value inspection without changing the selected dates. One-day ranges show
24 hourly points, 2–31 days show daily points, 32–120 days show calendar-week
buckets, and longer ranges show calendar months. First/last weeks and months
are clipped to the selected dates. Zero-activity buckets are included.

Aggregates run inside a repeatable-read database transaction, scoped by shop,
using PostgreSQL grouping. `created_at` and legacy event dates are stored as UTC
timestamps without a timezone; they are explicitly interpreted as UTC before
conversion to Philippine dates. New closing timestamps are `TIMESTAMPTZ(3)`.

## Historical records

All future ordinary and rider-workflow completions/cancellations record explicit
closing timestamps. Existing closing transition events are used by the migration
to recover known dates. No dates are inferred from `updatedAt` or `createdAt`.
Older completed orders without a dated transition remain undated and are excluded
from completion metrics; the dashboard displays the shop-wide excluded count.
They can still appear in orders received on their creation dates.

The dashboard refreshes every 15 seconds and is invalidated by order/workflow
updates. Query keys include shop and date range; analytics never depend on the
orders list's pagination or filters. API responses are private and not cached.

## Verification

From `server`, run the build and `node --test tests/*.test.cjs`. Analytics tests
exercise date boundaries, sparse series, ownership, aggregates, and closing
timestamps using isolated database doubles. They do not apply migrations or
query production data.

From `mobile`, run `npm run typecheck`, `npm test`, `npm run build:web`, and
`node tests/ui-browser.cjs --analytics`. Browser fixtures verify responsive
layouts, the single-metric toggle, exact values, date validation, workload links,
and empty/error states without accessing production services.
