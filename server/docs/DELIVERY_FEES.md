# Road-distance delivery fees

New rider bookings require a customer-approved server quote. Self-service bookings
have no transport charge. Historical bookings keep their existing delivery fee;
historical rider earnings are shown as unavailable rather than invented.

## Setup

1. Apply `npm run prisma:deploy` and `npm run prisma:generate` in server.
2. Configure `MAPBOX_ACCESS_TOKEN` on the backend. The existing public Mapbox token
   can be used if it permits server-side Directions requests. Never return it in API responses.
3. Restart the backend and rebuild/restart the app.
4. In admin **Delivery Operations > Delivery fee settings**, save the base fee,
   rate per kilometer, minimum combined fee and commission percentage. Suggested
   defaults are PHP 30, PHP 10/km, PHP 30 minimum and 15% commission. They are not
   activated until an administrator saves them.

No database reset or historical repricing is required. The local setup has the
additive migration applied and reuses the existing public Mapbox token in the
backend environment. Deployed environments need their own configuration.

## Calculation and approval

The server requests Mapbox driving distance separately from the customer collection
pin to the shop, and from the shop to the return pin. Direction matters; one-way
roads can make the two distances different. Rider travel to the collection point
is not billed. Unselected trips have zero distance and zero earnings.

`fee = max(minimumFee, baseFee + (pickupKm + returnKm) * ratePerKm)`

The base and minimum are applied once to the combined fee. Commission is rounded
to cents, then deducted. The remaining rider pool is divided by each selected
trip's road distance; any rounding cent stays with the return trip. If both trips
have zero road distance, the pool is split equally. A single selected trip
receives the entire pool. Currency uses Decimal arithmetic on the server.

The checkout displays one delivery fee and total, plus each trip's road distance.
**Place Order** confirms the displayed quote. Missing pins, routing failures and
unconfigured rates prevent rider bookings; no straight-line estimate or old PHP 30
fallback is charged. Laundry weight changes affect laundry service prices only.

Quotes belong to the customer, bind the shop and selected trip pins/options,
expire after 30 minutes, and are consumed once inside the booking transaction.
Repeated quote requests reuse a valid quote. Changes to relevant transport inputs
request another quote; countdowns stop when booking details change. Expiry or a
server-detected location change requires reviewing the replacement quote and
pressing Place Order again. Policy changes preserve unexpired quotes and confirmed
bookings. After confirmation, addresses/options cannot be edited through the
existing booking APIs: cancel/rebook under existing cancellation rules to approve
different transport details. No admin/rider endpoint silently reprices an order.

## Earnings and existing payments

The confirmed transaction stores its distances, fee policy revision, commission,
pickup/return allocations and confirmation timestamp in `delivery_pricing`.
Reassignment changes who can complete a trip, never its customer fee or allocation.
Only Completed assignments count toward the authenticated rider's 30-day earnings;
offers and active jobs show a potential amount, and reassigned/declined jobs earn
zero. This records earnings; it does not initiate wallet transfers or bank payouts.
Cash on Delivery, invoice and order totals continue to use the saved delivery fee.

## API and checks

- Admin-only `GET/PUT /api/admin/delivery-fees`; PUT requires the current revision.
- Customer `POST /api/transactions/delivery-quote` with shop, trip options and pins.
- Booking `POST /api/transactions` includes `deliveryQuoteId` and reviewed prices.
- Existing rider board/jobs/performance APIs expose read-only stage earnings.

Run `npm run test:fees` in server, the existing pricing/dispatch/weight/performance
checks, and `npm run typecheck` plus order-review tests in mobile. Tests use mocked
routing/database requests and never create live customer orders. A live read-only
Mapbox driving-route request was also verified during implementation.
