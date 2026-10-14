# Shop navigation

Shop pages use a literal `app/shop` directory so their URLs include `/shop`.
All five pages share `app/shop/_layout.tsx` and its existing Expo Router `Tabs`:

| Tab | URL |
| --- | --- |
| Home | `/shop/home` |
| Orders | `/shop/transactions` |
| Services | `/shop/services` |
| Customers | `/shop/customers` |
| Profile | `/shop/profile` |

The previous `(shop)` route group did not appear in URLs. Both shop and customer
Home/Profile routes therefore shared `/home` and `/profile`. This allowed links
and refreshes to select a different navigator. Explicit tab links and distinct
shop URLs remove that ambiguity. `/profile` remains the customer profile.

Expo Router owns the active tab and the bottom bar's space in the layout. The bar
includes the bottom safe-area inset; `Screen` only applies the top and side safe
areas on every shop page. Every tab has a child `Stack`, so its secondary pages
stay inside the same five-tab shell and keep that tab selected. Order details no
longer hide the bottom bar. The bar also remains visible while entering text.
The Profile button for switching to customer mode still changes navigator
deliberately, while the customer Profile button opens `/shop/profile`.

Run `npm run test:navigation` from `mobile` for the routing regression checks.
They use Expo Router's real file-tree builder and URL/state converters, with the
native UI bridge replaced by its actual standalone path validator. They cover
all five direct URLs, refresh round trips, Profile transitions, nested settings,
notifications, customer filters, order actions, and mode switches.
They do not replace browser interaction testing.

For a manual check, start the server and run `npm run web -- --clear` in `mobile`.
Sign in as a shop owner, open Profile from Home, and switch to each of the other
four tabs. Check that all five labels remain visible and only the selected tab
is highlighted. Refresh `/shop/profile` and open it in a new tab. At a mobile
viewport width, scroll the content to the end and check that the bottom bar stays
visible without covering content.

Also open Account Information, Shop Details, and Security from Profile, including
Security's follow-up pages. Open notifications and the map from Home, a
transaction from Orders, and a filtered customer list and order details from
Customers. All five tabs should remain visible and the originating tab should
stay selected. Refresh each secondary page and switch to another tab.

`useFlowNavigation` uses the current route segments when opening a flow. In shop
mode it opens `/shop/<current-tab>/<flow>`. Customer and public flows continue to
use the existing root flow route. The shared `FlowScreens` renderer supplies the
same page components in both layouts. Old shop flow URLs redirect to their nested
versions, and `/shop/orders/<id>` redirects to `/shop/customers/orders/<id>`.

## Files changed

- Moved shop routes from `app/(shop)` to `app/shop`. Each main tab now contains
  `index.tsx`, `_layout.tsx`, and `[flow].tsx`, using the shared
  `src/navigation/ShopTabStack.tsx`. The existing five main page components and
  their designs are preserved.
- Removed route-based bar hiding in `app/shop/_layout.tsx`; order details now
  live under `app/shop/customers/orders/[id].tsx`. The previous order URL and
  settings URL remain as redirects.
- Updated shop links in `src/design/AuthScreens.tsx`, `ShopScreens.tsx`,
  `ProfileScreens.tsx`, `OrderScreens.tsx`, `NotificationsScreen.tsx`, and
  `UserScreens.tsx`.
- Moved the shared flow renderer to `src/design/FlowScreens.tsx`;
  `app/(flows)/[flow].tsx` re-exports it for existing public/customer flows.
- Added the scoped navigation hook in `src/design/data.ts` and its route helper
  in `src/navigation/flow-target.ts`.
- Updated safe-area route detection and the shop Back fallback in `src/design/ui.tsx`.
- Added `tests/shop-navigation.test.cjs` and the `test:navigation` script in
  `package.json`.
- Updated the route references in `docs/FLUTTER_DESIGN_MIGRATION.md` and
  `docs/flutter-design-map.json`, and added this walkthrough.
