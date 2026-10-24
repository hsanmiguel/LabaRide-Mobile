# Shop registration and structured addresses

Shop registration now shows validation and API failures on the page, including in the browser. React Native Web's `Alert.alert()` is a no-op in the installed version, which previously hid missing-field and server errors.

The backend creates a pending shop application with an atomic nested write. Its response includes the application, the safe profile, and a refreshed token. Shop ownership stays disabled until an admin approves the application. The application screen displays its current status and the admin's reason for rejection or suspension. For setup and review instructions, see [Admin shop approval](admin-approval.md).

## Run and test in PowerShell

From the repository root, start the API in one terminal:

```powershell
cd server
npm.cmd run dev
```

Start the browser app in a second terminal, also from the repository root:

```powershell
cd mobile
npm.cmd run web -- --clear
```

Stop an old development process with Ctrl+C before restarting. Refresh the browser, log in, and open Register Shop. Enter the shop name, contact number, opening and closing times, and every address field marked `*`.

- Required: address line 1, city/municipality, state/province/region, ZIP/postal code, country, and address type.
- Optional: address line 2, access code, and dropoff instructions.
- Address types: Home, Work, Hotel, Apartment. Shop setup starts with Work; customer address setup starts with Home.
- Latitude, longitude, the location picker, and location-permission requests have been removed from address forms.

Click Submit for Approval. A successful submission displays Pending Approval. Missing fields and server failures appear above the button. Only approved applicants can use Open My Shop. Rejected applicants can correct their application and resubmit. Changes to an approved shop's details return it to pending review.

## Data compatibility

Migration `20261009010000_structured_addresses` adds the requested snake_case fields to users, shops, and order address snapshots. Existing optional coordinate columns are retained for compatibility with previously stored shop locations; address submissions no longer require or send coordinates. Postal codes and access codes stay strings to preserve leading zeros.

Existing records and legacy address columns are retained. New columns are nullable for existing accounts and historical orders; the API requires a complete structured address for new shops, shop edits, address saves, and orders. Personal profile edits can be submitted independently. Existing addresses display their old text until their owner completes the new address form. No missing city, postal code, or location is invented during migration.

Default addresses persist in Supabase. Additional saved addresses continue to use the existing per-user device/browser storage and now include address types and delivery instructions. Checkout stores a delivery address snapshot; pickup orders use the shop address. Access details and instructions are stored separately from the formatted street address and displayed in customer and shop order details. Order endpoints check customer or shop ownership before returning address details or changing an order.

For a fresh checkout or another database, apply the migration before running the updated app:

```powershell
cd server
npm.cmd run prisma:generate
npm.cmd run prisma:deploy
```

## Verification

```powershell
# In server/
npm.cmd run test:database
npm.cmd run test:shop
npm.cmd run test:shop:integration

# In mobile/
npm.cmd run typecheck
```

The integration command uses the configured database and real HTTP routes inside one transaction. It tests authentication, validation, shop approval and suspension, stale sessions, owner-only edits, pricing, and delivery/pickup orders. It rolls back all fixtures and verifies unchanged counts in all ten application tables. It neither deletes existing records nor prints credentials. PostgreSQL sequences may advance when rolled-back fixtures allocate IDs.
