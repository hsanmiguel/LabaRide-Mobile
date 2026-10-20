# Admin shop approval

Sign in with an administrator account to open the separate admin panel at `/admin`. Its exclusive **Dashboard** tab appears in a desktop sidebar or phone bottom navigation. Admin sessions stay in this panel, including when following customer or shop links or using browser Back. Sign out to use a different account. Customer and shop navigation do not include admin links.

The dashboard shows shop and owner contact information, address, business hours, status, reviewer, and latest decision reason. Search and status filters help locate applications.

## Application lifecycle

- New applications start **Pending**. Existing shops also become pending when migration `20261020000000_shop_approval` is applied. No shops are automatically approved.
- Only an admin can approve a pending application. Approval publishes the shop and enables shop mode, service setup, photo uploads, and customer orders.
- Rejection requires a reason. The applicant can read the reason, correct the details, and resubmit the same application; a second shop cannot be created for the account.
- An admin can suspend an approved shop with a reason, then restore it later. Suspended applicants cannot clear suspension by resubmitting.
- Editing approved shop details submits a new application version for review and temporarily hides the listing and locks shop mode. Prices and photos can be managed without repeating identity review.
- Customer order history remains available when a shop is hidden. New bookings and shop order management require approval.

Application status refreshes every 15 seconds, with manual refresh buttons available. The API checks current permissions on every authenticated request, so stale JWT role claims cannot grant admin or shop access. Approval decisions include the application version and expected status; outdated decisions return a conflict. Bookings lock the shop row and recheck approval before committing. Socket rooms require authentication and approved shop ownership.

## Setup

In `server/`:

```powershell
npm.cmd run prisma:generate
npm.cmd run prisma:deploy
```

Grant admin access to an existing registered account:

```powershell
npm.cmd run admin:set -- your-email@example.com
```

Revoke access:

```powershell
npm.cmd run admin:set -- your-email@example.com --revoke
```

To create a new admin account, set `LABARIDE_ADMIN_PASSWORD` in the process environment, run `npm.cmd run admin:create -- your-email@example.com`, then remove that environment variable. The password must contain at least eight characters and is stored as a bcrypt hash. This command refuses to overwrite an existing account. Do not put passwords in source files or committed configuration.

Restart the API and refresh/restart the Expo app after upgrading. Sign in again to receive the current account role. Public signup and profile updates cannot assign admin privileges.

## Verification

```powershell
# server/
npm.cmd run test:approval
npm.cmd run test:shop:integration

# mobile/
npm.cmd run typecheck
npm.cmd test
npm.cmd run build:web
npm.cmd run test:ui -- --approvals
```

The HTTP unit tests use isolated in-memory fixtures. The database integration test rolls back every test account, application, decision, and order, then checks all ten application table counts. The browser test uses intercepted fixtures and checks the dashboard at phone and desktop sizes, reason validation, cancellation, rejection and resubmission, approval, suspension, and direct URL guards. Native device behavior requires a device check.
