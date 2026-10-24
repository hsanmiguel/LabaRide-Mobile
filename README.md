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

## Service packages

In the shop's **Services** screen, choose **Add Service** (or **Edit** on an existing
service), select **Fixed price per load**, and enter the service name, kilograms
per load, and price per load. For example, **Full service**, **8 kg**, **215**
charges ₱215 for up to 8 kg and ₱430 for more than 8 kg through 16 kg. Each
additional partial load is charged as a full load. Delivery fees are added
separately. Shops can create multiple services with different weights and prices.
Use **Delete** on a service card or **Delete Service** in its edit dialog to remove
it from the shop's menu after confirmation. Existing orders remain available.

Deliveries for services named **Full Service** require at least two hours from
order placement. The time picker displays the earliest available delivery time;
checkout and the API recheck the minimum when an order is submitted. Pickup
orders do not require a preferred collection date or time. Other delivery
services require a future schedule.

The delivery scheduler presents Today, Tomorrow, Next Day, and an inline
calendar before a two-column grid of suggested times. Suggestions follow the
selected service's preparation minimum and the shop's Philippine operating
hours, including overnight hours. Exact minute-level entry remains available.
Thirty-minute suggestions are a display convenience, not reserved capacity or
a new restriction on exact-time bookings. No delivery-capacity calendar is
configured in the current system.

The modal keeps its header and confirmation footer visible while its body
scrolls. Invalid saved times are replaced with an available time, changing the
date refreshes suggestions, and closing discards unconfirmed changes. The API
rechecks preparation time and current shop hours before saving the order.
Date-only delivery fields retain the selected Philippine calendar day.

Run `npm run test:schedule` in `mobile/` and `server/` for scheduling coverage.
After `npm run build:web` in `mobile/`, run
`node tests/ui-browser.cjs --schedule` for isolated Chrome checks at 320, 390,
768, and 1440 pixels. These browser tests intercept API requests and create no
live orders; screenshots are saved under `mobile/artifacts/ui-redesign/`.

Customers choose services and tap **Review Order** to open one **Order Summary**
page containing service prices, weight, clothing quantities, delivery/pickup,
addresses, schedule, notes, Cash on Delivery, fees, and the total. Address,
quantity, and delivery schedule editors open in popup dialogs on that page. After
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

## Order notifications

New bookings and order status changes save separate notification records for the
customer and shop owner in the same database transaction as the order change.
The Notifications screen shows each event with its timestamp, highlights unread
events, and marks a notification read when opened. Earlier status messages remain
available after an order changes again. Records start when this migration is applied;
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
