# LabaRide 2.0 (Migration Project)

This project is a complete migration of the LabaRide application from Flutter/Flask/MySQL to a modern React Native (Expo) and Node.js (Express/Prisma/PostgreSQL) stack.

## Architecture

```
LabaRide/
├── mobile/         # React Native + Expo (TypeScript)
│   ├── app/        # Expo Router (Screens)
│   ├── src/        # Shared logic, API client, State (Zustand)
│   └── package.json
│
└── server/         # Node.js + Express (TypeScript)
    ├── prisma/     # PostgreSQL Schema & Migrations
    ├── src/        # Controllers, Routes, Sockets
    └── package.json
```

## Prerequisites
- Node.js 24.19.0 (the mobile app uses Expo SDK 57)
- A Supabase project and its database password (or a local PostgreSQL server)
- Expo CLI

## Installation & Setup

### 1. Database (Supabase)
The backend uses Prisma to connect to Supabase PostgreSQL. The mobile app calls
the Express API; database credentials stay in `server/.env`.

The environment template is configured for project `domftqrekdrimtulkvxf`.
Follow [the Supabase setup guide](server/docs/SUPABASE_SETUP.md) to set the
database password, deploy the tables, and verify the connection.

### 2. Backend (Server)
```bash
cd server
npm install

# Configure your environment variables
# Copy .env.example to .env if it does not exist, then set the database URLs
# and a random JWT_SECRET. Never overwrite an existing configured .env.

# Deploy the initial migration to a new database (no shadow database needed)
npm run prisma:generate
npm run prisma:deploy
npm run db:check

# Start the server
npm run dev
```

The backend uses port `5001`. Check `http://localhost:5001/health` to verify it
is running.

### 3. Frontend (Mobile)
```bash
cd mobile
npm install

# Copy .env.example to .env and set EXPO_PUBLIC_API_URL to your backend URL

# Start the Expo development server
npx expo start
```

Use `http://localhost:5001` for the API in a browser on this computer, or
`http://<your-computer-LAN-IP>:5001` in Expo Go on a physical phone. After changing
`mobile/.env`, restart Expo with `npx expo start --clear` and fully reopen the app.

The mobile app supports Node.js 24. In PowerShell, use `npm.cmd install` and
`npx.cmd expo start` if `.ps1` script execution is disabled.

## Delivery and laundry collection areas

New orders are accepted only during the shop's operating hours in Philippine
time (Asia/Manila). Opening time is included; closing time is excluded.
Overnight hours, such as 10 PM to 4 AM, work across midnight. Missing or invalid
hours block ordering. Owners can turn off **Accept orders during business
hours** in Shop Details to temporarily stop new orders without losing approval.
Checkout and the API both check availability, including after the order
countdown and immediately before the booking is saved.

In **Shop Profile > Shop Details**, owners can set separate minimum and maximum
distances in kilometers for delivery and collection of unwashed laundry from a
customer's address. Collection is opt-in. Leave a minimum blank for 0 km and a
maximum blank for no distance limit. Hours, contact details, service areas,
services, and prices update immediately for approved shops. Shop name and
physical address or map location changes require admin review again and pause
the listing and shop mode until approved. Rejected applications still require
resubmission and approval.

Service areas use straight-line distance between map pins, rather than road
distance. A shop pin is required to configure a range; customers must pin their
address when booking a service with distance limits. Checkout and the API both
enforce the limits, including a final check against the shop's current rules.

Checkout separates **Getting Laundry to the Shop** from receiving finished
laundry. Customers can choose shop collection when offered and use their saved
customer address for collection and return delivery. Collecting finished
laundry from the shop has no distance limit or required pickup schedule.
Collection details remain visible in customer and shop order details.

Apply the service-area migration with `npm run prisma:deploy` and regenerate the
client with `npm run prisma:generate`. Run `npm run test:areas` in `server/` and
`npm run test:review` in `mobile/` for the booking and distance checks.

## Shop verification

New shops must upload **DTI or SEC registration**, **TIN proof**, and a **Mayor’s
Permit** after saving their shop details. Admins inspect and verify the private
documents before enabling the shop. Account Credibility now shows real upload and
review statuses; owners can replace documents returned for correction. Existing
approved shops stay active. See [shop requirements](server/docs/SHOP_REQUIREMENTS.md)
for migration, privacy and verification details.

## Service packages

In the shop's **Services** screen, choose **Add Service** (or **Edit** on an existing
service), select **Fixed price per load**, and enter the service name, kilograms
per load, and price per load. For example, **Full service**, **8 kg**, **215**
charges ₱215 for up to 8 kg and ₱430 for more than 8 kg through 16 kg. Each
additional partial load is charged as a full load. Delivery fees are added
separately. Shops can create multiple services with different weights and prices.
Use **Delete** on a service card or **Delete Service** in its edit dialog to remove
it from the shop's menu after confirmation. Existing orders remain available.

Customers choose how dirty laundry reaches the shop (customer drop-off or rider
pickup) separately from how clean laundry is returned (customer collection or
delivery). Rider pickup requires a requested time within the shop's operating
hours and a collection address inside its pickup area. Return delivery is arranged
once the laundry is ready; checkout does not require a return delivery schedule.

After receiving the laundry, the shop supplies an estimated ready time based on
its queue. Revised estimates require a reason. Customers see receipt, processing,
and ready timestamps along with these updates.

Run `npm run test:schedule` in `mobile/` and `server/` for scheduling coverage.
After `npm run build:web` in `mobile/`, run
`node tests/ui-browser.cjs --schedule` for isolated Chrome checks at 320, 390,
768, and 1440 pixels. These browser tests intercept API requests and create no
live orders; screenshots are saved under `mobile/artifacts/ui-redesign/`.

Customers choose services and tap **Review Order** to open one **Order Summary**
page containing service prices, weight, clothing quantities, delivery/pickup,
addresses, requested pickup time, notes, Cash on Delivery, fees, and the total. Address,
quantity, and requested pickup time editors open in popup dialogs on that page. After
confirming those details, **Place Order** submits the booking directly; there
is no separate checkout step.

Unsubmitted order drafts survive browser refreshes in the same tab and native
app restarts. Drafts are restored before checkout renders and are kept separate
per account. Successful orders clear the saved draft; a countdown is never
resumed or submitted automatically after a refresh.

Package prices are specific to their service and take precedence over general
kilogram price ranges. **Price per kilogram** remains available; existing
services retain their kilogram rates. If a customer selects multiple services,
each package is charged for the laundry's weight, and any kilogram services use
the shop's matching weight rate or their combined base rates.

Apply the service-package migration with `npm run prisma:deploy` from `server/`
and regenerate the Prisma client with `npm run prisma:generate` before starting
the updated backend. Run pricing checks with `npm run test:pricing` in both
`server/` and `mobile/`.

## Rider pickup and delivery

New delivery bookings use a rider job board: approved riders go online, browse
**Available**, and claim a pickup or delivery immediately. Claimed work appears in
**My jobs**. Customer details unlock after claiming. Admin assignment and
reassignment remain available for intervention. Partner processing, bilateral
handover confirmation, fallback codes and weight photos keep the existing workflow.
Riders select **Apply as a Rider** on the login page; admins review applications in
**Delivery Operations → Rider applications**. See the
[rider workflow guide](server/docs/RIDER_WORKFLOW.md) for setup, role permissions,
the full lifecycle, reassignment, exceptions, and verification. Automatic dispatch
is disabled. Existing orders and customer self-service pickup retain their workflow.

The Rider Dashboard job-details sheet previews a driving route between the saved
customer collection pin and the shop for pickup jobs, or the shop and the saved
return-address pin for delivery jobs. Only active, online riders can request a
route for an approved shop's currently available, unassigned job. The board itself
still returns approximate areas. Names, written addresses, contact details and
handoff codes remain protected until claiming. Missing pins show an unavailable
state; no location is guessed. Routing uses the existing public
`EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` and the Mapbox Directions API. Redeploy both the
API and app for the route-preview endpoint; this feature needs no schema migration.

## Customer rider tracking

After accepting/claiming a job, riders choose **Start sharing location** in Available
or My jobs and grant foreground location access. Customers open their order and
see **Track your rider**, with rider/customer/shop pins, GPS accuracy and the last
update time. The customer screen refreshes every five seconds; the rider samples
GPS about every 15 seconds and publishes movement at most once per ten seconds.

Keep LabaRide open: switching apps, locking the phone, stopping sharing or finishing
the job pauses/ends updates. Old readings are labeled last known after 45 seconds.
This is foreground tracking, not background tracking or an ETA/road routing service.
Browser GPS requires HTTPS or localhost; use the mobile app for HTTP LAN testing.
Live coordinates are available only to that order's customer and admins. Apply
`20261024020000_rider_location` with `npm run prisma:deploy` and regenerate Prisma
before deploying the API. Physical-device GPS still needs a phone test.

## Measured weight photos

For managed delivery orders, shops must attach a clear scale photo and explanation
when updating the measured weight and final price. Customers can view the photo,
weight, price, timestamp and earlier records in their order details. Photos are
private to that customer, the owning shop and admins. Run `npm run prisma:deploy`
and `npm run prisma:generate` in `server/` for the weight-evidence table.

## Order notifications

New bookings and order status changes save separate notification records for the
customer and shop owner in the same database transaction as the order change.
The Notifications screen shows each event with its timestamp, highlights unread
events, and marks a notification read when opened. Earlier status messages remain
available after an order changes again until the user deletes them. Read items have
**Delete**, and **Delete read** clears read items in the current customer/shop/rider/
admin list after confirmation. Unread items and other users' notifications are
protected by the API. Deleting notifications does not change orders or audit history.
Records start when this migration is applied;
historical orders are not converted into invented notification events.

Apply the notifications table with `npm run prisma:deploy` and regenerate the client
with `npm run prisma:generate` in `server/` before deploying the updated API.
Order lists and notification screens refresh every 15 seconds while active, including
on the Vercel HTTP API. Standalone Socket.IO events also refresh these queries.
Set `EXPO_PUBLIC_REALTIME_MODE=polling` for Vercel to disable unsupported socket
connections. These are in-app notifications; device push, SMS, and email delivery
are not configured.

Run server checks with `npm run build` followed by
`node --test tests/notifications.test.cjs tests/cancel-order.test.cjs tests/order-schedule.test.cjs`.

## Migration Notes

The original Flutter screen designs and assets are recreated in `mobile/src/design`
and `mobile/assets/flutter`. See [the screen migration map](mobile/docs/FLUTTER_DESIGN_MIGRATION.md)
for all 74 source design files, React Native routes, and API support. Captured mobile
screen previews are in `mobile/artifacts/design-preview`.

- **Data Transfer:** See `MIGRATION_DATA.md` (in the `server/` directory or your IDE artifacts) for the SQL script necessary to migrate data from the legacy MySQL database.
- **Authentication:** Sessions are now handled via secure JWTs stored in `expo-secure-store` managed by Zustand.
- **Sockets:** Real-time transaction tracking is preserved using `socket.io-client` mapped to the Express server.
