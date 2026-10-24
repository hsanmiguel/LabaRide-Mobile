# Rider dispatch and laundry delivery

## Access and setup

Apply migrations with `npm run prisma:deploy`, run `npm run prisma:generate`, and
deploy the server and mobile/web app together. The rider migration is additive.
Existing orders retain their original workflow. New return-delivery or `ShopPickup` bookings use the coordinated workflow.
Customer drop-off skips rider collection; customer return pickup skips rider
return delivery. Fully self-service bookings retain the original workflow.

1. A rider chooses **Apply as a Rider** on the login page and submits their
   name, email, contact number, password, and password confirmation.
2. A private draft opens with four steps: **Personal details**, **Motorcycle details**,
   **Documents**, and **Review & submit**. Save progress before leaving. Applicants
   must be at least 18, provide a current professional license, and enter their
   motorcycle registration details. There is no engine cc limit or vaccination requirement.
3. Upload clear JPG/PNG/WebP images up to 6 MB: a recent **2×2 applicant photo**,
   professional license, NBI or National
   Police Clearance, proof of TIN, motorcycle OR, and CR. A borrowed motorcycle also
   needs owner authorization/deed of sale. Only the applicant and authenticated admins
   can read images; responses are private/no-store and metadata lists omit image bytes.
   Confirm accuracy and review authorization, then submit. Pending riders cannot go
   online or receive assignments. Signing in resumes their application/status screen.
   The applicant photo should be front-facing with a plain background. Native pickers
   allow a square crop; the server saves a centered 600×600 JPEG. Applicants can preview
   and replace it, and admins review it with the other required documents. It is not
   published as a public profile photo. Existing active riders are not deactivated.
4. An administrator opens **Delivery Operations → Rider applications → Review application**,
   inspects the personal/vehicle details, and verifies each required document. Approval
   is blocked until all documents are verified and details are complete. Document
   rejection returns the application with feedback; applicants replace the document
   and resubmit. Editing details invalidates earlier document verification. Version
   checks prevent review of a replaced image. The status screen polls every
   15 seconds and opens the rider dashboard automatically after approval. A rejected
   applicant sees the review reason. Existing enabled rider accounts remain approved.
5. The rider can go online
   and optionally update their dispatch coordinates with location permission.
6. The laundry partner confirms a booking with an acceptance explanation.
7. A confirmed `ShopPickup` appears in the rider's **Available** board. An online rider
   claims it and starts from **My jobs**, without an admin offer or second acceptance.
8. After processing, the partner marks the laundry ready. Customer collection
   stays at the shop until the partner confirms collection. Return delivery
   appears in the rider board. A separate delivery
   job appears on the same board and can be claimed by the same or a different rider.

### Available Jobs (pull method)

`/rider` is the Available board; `/rider/jobs` contains accepted work and any admin
offers. Both mobile bottom navigation and the desktop sidebar have Available,
My jobs, History and Updates. Notification links go to My jobs.

The board uses `GET /api/delivery/available-jobs`, accessible only to active riders.
Go online to browse. Pickups require `PickupQueued`; returns require
`ReadyForDelivery`. The shop must be approved and the order must have no Offered or
Accepted assignment. Pending bookings, processing laundry, in-custody exceptions,
closed orders and jobs reserved by admin offers never appear. Expired normal offers
and failed pickups return to the board when their state becomes eligible.

Previews include order ID, service, kilograms, schedule, shop name, approximate city/
province areas and approximate distance to the collection point. They exclude
customer names, exact addresses/coordinates, contact, instructions, notes, access
codes, handoff codes and images. Exact customer details unlock only in an accepted
job. Distances are rounded straight-line estimates from the rider's saved position;
missing coordinates remain claimable with Distance unavailable. The oldest 100 jobs
are loaded; riders can filter Pickup/Delivery and sort oldest or nearest first.

`PUT /api/delivery/orders/:id/claim` accepts `{stage, expectedVersion}`. It locks the
order before the rider user row, rechecks availability, online/active access, shop
approval, version and the three-job limit, then creates an Accepted assignment and
advances to PickupAccepted/DeliveryAccepted in one transaction. Two riders claiming
one job have one winner; concurrent claims by one rider cannot exceed capacity.
Retries by the successful rider acknowledge the existing assignment without extra
events. Audit and customer/partner/admin/rider notifications commit with the claim.
There is no five-minute offer timer for claimed jobs. The non-null legacy expiresAt
field stores the claim time and is ignored for Accepted assignments.

The board refreshes via existing socket invalidations or 15-second polling. Failed
claims refresh the board and show an actionable message. Existing admin assignment,
offers, reassignment, handovers, evidence and history remain supported. No additional
schema migration is needed for the pull method.

### Admin intervention: choosing a nearby rider

The admin navigation is **Delivery Operations** (**Operations** on compact mobile
tabs). It opens the All queue for monitoring, with order details/audit as the primary
action and manual assignment as a compact secondary action. Rider review and account
controls stay available on the same page. Manual assignment is for intervention;
routine eligible jobs remain available for riders to claim.

Riders first go online and choose **Update dispatch position** with location access.
In **Delivery Operations → Unassigned → Assign / reassign rider**, eligible riders are sorted
by approximate straight-line distance to the customer's saved booking pin for a
pickup, or the partner shop's saved pin for a clean-laundry delivery. Workload is
used to break distance ties. The dialog shows distance, the nearest rider, and
other active-job counts; this order is excluded from workload during reassignment.
Only active, online riders with fewer than three other open jobs are listed.

Riders with missing/invalid coordinates appear last with **Position not provided**.
If the collection location has no pin, distances are unavailable and the list uses
workload instead. Manual assignment remains possible. Distances use saved positions,
not live GPS or road routing, and are not travel-time estimates. Options refresh
every 15 seconds while the dialog is open, with a manual refresh button. Selecting
a rider and sending the offer are explicit admin actions; automatic dispatch remains off.

The administrator's existing shop management remains under Dashboard.
Partners use their existing orders dashboard, and customers use Activities/order
details; managed orders open the shared delivery timeline with role-specific actions.

## Lifecycle

`BookingPending → PickupQueued → PickupAccepted → PickupEnRoute
→ LaundryPickedUp → AtPartner → LaundryReceived → Washing → Drying → Folding
→ ReadyForDelivery → DeliveryAccepted → CleanLaundryCollected
→ OutForDelivery → Delivered → Completed`

Admin offers optionally insert PickupAssigned/DeliveryAssigned before acceptance.
Only the customer can make the final receipt confirmation. Pickup and delivery can
use the same rider or different riders. Delivery state is stored separately from
the original Pending/Processing/Completed/Cancelled status used by existing lists.
Partners may remeasure weight during processing; the server recalculates the price
using that shop's current services and rates and records the change in the timeline.

## Dispatch, exceptions, and proof

Offers expire after five minutes and are cleaned up on authenticated operations or
rider-dashboard or board polling. Declines, expiry, and failed pickups return to
the public board when the order is PickupQueued/ReadyForDelivery, or otherwise to
admin attention. There is no background expiry worker when nobody is polling.
An eligible rider is active, online, and has fewer than three open jobs.
Repeating the same accept/decline response acknowledges the saved decision without
duplicating workflow changes, events or notifications. Opposite decisions, expired
offers, reassigned jobs and closed orders remain protected. The rider UI prevents
simultaneous submissions, refreshes jobs after a failed action and closes stale offer
dialogs. An accepted job does not expire when its original offer deadline passes.

The admin may override an assignment with a mandatory reason. Reassignment during
custody must follow an actual handover between riders; the UI explicitly asks the
admin to confirm this operational step. The new rider resumes the existing stage.
The previous rider immediately loses status-change access and customer contacts.

The primary handover flow does not require typing a code:
1. The accepted rider starts the pickup trip and taps **Arrived at customer**.
2. The customer opens the order from their notification and taps **I handed over the laundry**.
3. The rider taps **Confirm laundry received** after physically checking it.

At clean-laundry collection the rider marks arrival at the shop, the partner confirms
handover in their order details, and the rider confirms receipt. At final delivery
the customer confirms receiving clean laundry and the rider finishes delivery,
closing the order without another customer confirmation. The code fallback still
uses the existing final customer receipt action. Arrival and handover
actions are audited and notify everyone involved. They keep the current workflow
stage until the rider finishes. Each confirmation is scoped to that assignment and
handover type, so reassignment requires fresh confirmation. Version checks and the
order row lock prevent stale actions or repeated submissions.

**Use code instead (fallback)** remains available if the other person cannot use
their account. An accepted rider can find the current six-digit handoff code on the newest
notification for that order in Updates. The label distinguishes customer pickup,
clean-laundry collection from the shop, and customer delivery. Notification reads
resolve current assignment and workflow access; codes are never stored in notification
messages and are omitted after the relevant stage or reassignment. Existing accepted
jobs also receive this display on refresh. Offered riders and admins receive no codes.
Rider list/detail APIs still omit codes. Codes now identify the correct handoff rather
than independently proving customer/partner consent, since the rider can read them.
Confirm only after the physical handover. The partner still confirms receipt at the
shop, and the customer still confirms final receipt in their app.

Customers can cancel before booking confirmation. Partners/admins can cancel before
the laundry is collected; in-custody problems require an issue report and recovery
or reassignment. Issue reports appear in the admin Issues queue; admins record
resolution in the order timeline. Failed pickups require a reason and release the
rider's assignment. Active jobs must be reassigned before disabling a rider.

### Customer rider map

Riders explicitly enable **Start sharing location** in Available or My jobs. The
layout-level provider persists across rider tabs, requests foreground permission,
watches movement, and samples current GPS every 15 seconds while foregrounded.
Writes are throttled to one per ten seconds; failures remain visible and retry with
the next reading. App backgrounding, logout, stopping sharing, or having no active
travelling jobs removes the watcher and clears the current sharing session. Keeping
LabaRide open is required; external navigation apps pause foreground updates.

`PUT /api/delivery/location` accepts an authenticated rider's session ID, coordinate,
accuracy and GPS timestamp, or a session-scoped stop. It updates only their currently
Accepted assignments in PickupAccepted/PickupEnRoute/LaundryPickedUp or
DeliveryAccepted/CleanLaundryCollected/OutForDelivery. No order IDs are accepted
from the device. Invalid, old, future or out-of-order readings are rejected/ignored.
A delayed stop from a previous watcher cannot clear a newer sharing session.

`GET /api/delivery/orders/:id/tracking` is private/no-store and customer/admin only.
It exposes the currently accepted rider's point and timestamps, GPS accuracy, the
order's saved customer/shop pins, and waiting/paused/sharing/stale/finished states.
It never uses the dispatch-position snapshot as a live position. General order,
operations, job-board and rider-job responses omit assignment GPS/session fields.
Reassignment, failed pickup, cancellation and job completion clear the stored point.
Only the latest point is retained per assignment; no route history is collected.

The customer's **Track your rider** card polls every five seconds and independently
ages cached data. Readings older than 45 seconds or failed refreshes are labeled
last known; no route or ETA is invented. The embedded Leaflet map works in web and
the existing native WebView dependency, with rider/customer/shop markers, recenter,
and last-known coloring. Map tile failure does not hide the textual GPS status.

Deploy `20261024020000_rider_location`, regenerate Prisma, and deploy API/app
together. Browser geolocation needs HTTPS or localhost; an HTTP LAN host cannot
provide browser GPS. Expo Go supports this foreground workflow. Background location
requires additional native configuration/builds and is not implemented. The app's
custom native permission text is applied on rebuilding the binary. See the
[Expo Location reference](https://docs.expo.dev/versions/latest/sdk/location/).

### Measured weight and scale photos

During LaundryReceived, Washing, Drying or Folding, the shop can save the measured
weight, an explanation and a clear photo of the laundry on a readable scale. The
photo is required for each new weight/price update. Camera capture is available on
native mobile; mobile and web both support choosing an existing image. The API
decodes, orients, resizes and re-encodes JPG/PNG/WebP images and removes EXIF metadata.

The measurement, recalculated price, photo, audit event and customer notification
commit atomically under the order lock and expected-version check. Each update
creates a new immutable record. The customer, owning shop and admin can see the
latest scale photo and earlier measurements in the order details, including weight,
total, explanation, uploader and timestamp. They can enlarge the uncropped photo.
These are shop-submitted photos; LabaRide does not verify the scale reading or use OCR.

Image bytes are excluded from order/list APIs. The authenticated photo endpoint is
private/no-store and denies riders, unrelated shops/customers and anonymous requests.
Historical orders do not receive invented weight proof. Deploy migration
`20261024010000_order_weight_evidence` and regenerate Prisma before running this API.

All workflow and assignment mutations lock the order row. Assignment offers also
lock the rider account to enforce workload limits. A partial database unique index
allows only one Offered/Accepted assignment per order stage. Requests carry the
expected workflow version to reject stale actions. Timeline events store the
actor, time, action, previous/next state, and explanation. Notifications commit in
the same transaction as the associated change.

Customer name, exact address, phone, access details, and order instructions are
provided only to the accepted rider while their job is active. Offers/history show
only the customer city/province. Shop locations are public. Backend permissions
come from current database roles, never JWT claims alone.

## Updates and intentionally deferred capabilities

Standalone Socket.IO sends payload-free `operations_update` invalidations; all
dashboards also poll every 15 seconds while active. Set
`EXPO_PUBLIC_REALTIME_MODE=polling` with the Vercel HTTP backend. Notifications are
stored in-app events, not device push notifications. Maps navigation uses a Google
Maps direction link; dispatch position remains an optional snapshot. Customer
tracking is a separate, explicitly enabled foreground GPS stream as described above.

`dispatch.service.ts` contains eligibility/workload/distance recommendation logic.
Automatic dispatch is a hard-coded disabled flag; there is no automatic scheduler.
Rider compensation, payouts, and earnings are not implemented, so no invented
earnings summary is displayed. Price revisions are notified and audited; there is
no card-payment charge or payout integration.

## Verification

- Server: `npm run build` then `node --test tests/*.test.cjs`.
- Tracking browser fixtures: `node tests/ui-browser.cjs --rider-tracking` verify
  consent, GPS uploads, stop, foreground pause/resume, customer marker updates,
  320/390/1440 layouts, accuracy, stale/error/paused/finished states. Browser tests
  use mocked GPS/API readings and a Leaflet fixture; real GPS and native WebView map
  loading still need physical-device verification.
- Concurrent pull claims: `node tests/pull-jobs.integration.cjs`. Uses separate real
  transactions to verify same-job, capacity and admin-assignment races. Creates
  isolated fixture accounts, scopes notifications to those accounts, deletes all
  fixture rows by exact IDs in finally, and verifies cleanup.
- Pull-board browser fixtures: `node tests/ui-browser.cjs --pull-jobs` verifies
  320/390/768/1440 layouts, privacy, filters/sort, claim/cancel, lost-race refresh,
  online toggle, workload limit, empty state and navigation to My jobs.
- Full real HTTP/database lifecycle: `node tests/delivery.integration.cjs`.
  Uses a rolled-back transaction; it creates no permanent test users or orders.
  Covers role denial, handoff codes, privacy, acceptance replay, decline, expiry,
  failed pickup, weight updates, mid-delivery reassignment, and receipt confirmation.
- Existing historical workflow: `node tests/shop-address.integration.cjs`.
- Mobile: `npm test`, `npm run typecheck`, `npm run build:web`.
- Browser fixtures: `node tests/ui-browser.cjs --delivery` (set `CHROME_PATH` to an
  installed Chromium browser if needed). Checks 320/390/768/1440 px rider layouts,
  proof dialog, history, updates, and 390/1440 px admin dispatch.

Browser tests use intercepted fixtures. Physical-device GPS/phone/maps handoff and
native keyboard behavior still need device verification before production rollout.
