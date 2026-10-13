# Role-based interface redesign

The existing Expo Router routes, API client, React Query caches, authentication,
Prisma models and transaction statuses remain in use. Expo Image Picker supports
shop and customer profile photo updates.

## Themes and components

`src/design/theme-tokens.ts` defines the customer blue (`#2457AD`) and shop purple
(`#321078`) palettes. `InterfaceTheme` scopes components to the active route group;
the root covers shared flows and the two tab layouts provide explicit scopes.
An owner deliberately entering customer mode gets blue. A shared screen inside
the shop stack stays purple. Use `usePalette()` in components, rather than
importing a global brand color. Existing color aliases resolve through the same
provider; neutral typography and spacing live in `ui.tsx`.

Both interfaces use Inter, white cards, neutral page backgrounds, 44px minimum
shared controls, visible web focus, labeled status badges, responsive content
widths, desktop sidebars and safe-area bottom tabs. Modal transitions are disabled;
native map movement respects reduced motion.

The sign-in page retains its previous blue-to-indigo gradient, white branding,
rounded white Login card, soft fields and bright blue Log In button.

`icons.ts` maps migrated interface asset names to installed Lucide exports. Bitmap
icon imports are removed from the bundle. Original assets remain on disk as
migration references; actual logos and illustrations are preserved. Only the four
used font weights are bundled.

## Screens and real data

- Customer discovery uses the live map component, searchable shop cards and
  nearby results ranked from valid saved coordinates. Distances are explicitly
  straight-line distances. A missing coordinate does not become a fictional pin.
- Optional current-position capture uses Expo Location after an explicit tap and
  permission grant. Address forms remain usable without location permission.
  Saved coordinates survive form edits and submission. Guests can keep a delivery
  location in their existing session draft.
- Shop dashboard metrics use existing orders. Orders have search, existing-status
  filters and selection; tables become cards below 768px. Service management,
  order review, pricing, account forms and confirmation flows remain connected.
- Sample vouchers, universal sample shop logos and unsupported service/day claims
  are no longer presented as real business data. Existing unsupported account
  linking, verification and range-editing controls are labeled or disabled.
- Customer profiles start with a neutral avatar placeholder. Customers can add,
  replace or remove their profile photo from the avatar control. Images are
  authenticated on upload and removal, normalized to JPEG, stripped of metadata,
  stored in the `user_photos` table, and served as cached, versioned image URLs.
  Shop photos use the same image validation and storage safeguards.

Web maps retain the OpenStreetMap embed, add coordinate-based shop selection and
an explicit retry/external-map fallback when the provider cannot be reached.
Native maps retain real markers, selection and pin callbacks. Attribution stays
inside the dedicated map area, separate from app controls.

## Verification

From `mobile/`:

```text
npm run typecheck
npm test
npm run build:web
npm run test:ui
```

`test:ui` requires a local Chrome installation (`CHROME_PATH` may override its
Windows default), a current `dist/`, and free loopback ports 4178 and 9227. It uses
an isolated headless browser profile and intercepts API requests with test-only
fixtures. It never writes to a real API or database. Screenshots and its report
are saved in `artifacts/ui-redesign/`.

Coverage includes separate customer/shop screens at 320, 390, 768 and 1440px,
theme leakage, long names/addresses, search, filters, service dialogs, order review,
loading, empty and failed requests. Unit tests cover provider isolation, palette
contrast (WCAG AA normal text), nearby sorting and coordinate preservation, plus
the existing navigation, cancellation, pricing, scheduling and service workflows.

Backend TypeScript build and local validator/controller tests also pass. The
Android production bundle was exported successfully with
`npx expo export --platform android --output-dir dist/native` (this validates
bundling, not a signed native release or a physical-device run). The
database integration test is not run; no live booking or account mutation is part
of UI verification. External map tiles were unreachable in the test browser, so
tile rendering could not be verified there. Physical-device map gestures,
geolocation permission behavior and native safe areas still need device QA.
