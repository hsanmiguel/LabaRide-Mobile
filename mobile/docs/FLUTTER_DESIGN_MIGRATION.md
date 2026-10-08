# Flutter design migration

The React Native design is ported from `advancedb_project/lib`. Original images and icons are copied without alteration to `assets/flutter` and statically registered in `src/design/assets.ts`. Inter and Poppins fonts are bundled through Expo Font.

## Implementation

- Shared controls, spacing, colors, typography: `src/design/ui.tsx`.
- Screen families: `AuthScreens`, `UserScreens`, `OrderScreens`, `ProfileScreens`, `ShopScreens`, and `NotificationsScreen` in `src/design`.
- Existing Expo routes remain entry points; additional flows use `app/(flows)/[flow].tsx`.
- User navigation has three tabs; shop navigation has the original five tabs.
- Checkout retains notes, laundry quantities, delivery/pickup, weight, address, schedule, and payment state across screens. Delivery uses the original fixed PHP 30 charge; pickup is free.
- Native maps use `react-native-maps`; web uses an OpenStreetMap embed. A physical device must reach `EXPO_PUBLIC_API_URL`; see `.env.example`.

## API coverage

The existing API supports login, signup, profile updates, password changes while signed in, account deletion, shop registration, reading shops/orders, adding services and kilo prices, placing orders, accepting/completing orders, and cancellation. Those controls are connected to the API. Notifications use actual order data in the original notification layouts instead of the Flutter demo messages. Additional addresses are stored per user on the device.

Email password recovery, social account binding, 2FA, shop detail updates, service/price edits and deletion, transaction deletion, document verification, tipping, and ratings do not have corresponding endpoints in the current server. Their designs are ported; actions report unavailable rather than claiming changes were saved. The original April 2025 voucher artwork is preserved, and expired vouchers cannot be applied.

Empty Dart files and the damaged fragments in `main.dart` and `welcome.dart` cannot be copied as executable Flutter code. The visible splash and onboarding designs are reconstructed from the remaining widgets and original assets.

## Screen mapping

| Flutter source (under lib)                           | React Native route                  | Component                                            |
| ---------------------------------------------------- | ----------------------------------- | ---------------------------------------------------- |
| `how.dart`                                           | `/how-it-works`                     | OnboardingScreen (how)                               |
| `loginscreen.dart`                                   | `/login`                            | LoginDesign                                          |
| `main.dart`                                          | `/`                                 | SplashDesign                                         |
| `shop/AuthenticationShop/registershop.dart`          | `/register-shop`                    | RegisterShopDesign                                   |
| `shop/CustomerOrder/AcceptingOrder.dart`             | `/(shop)/orders/[id] (pending)`     | ShopOrderDetailsDesign                               |
| `shop/CustomerOrder/CancelDetails.dart`              | `/(shop)/orders/[id] (cancelled)`   | ShopOrderDetailsDesign                               |
| `shop/CustomerOrder/CompleteDetails.dart`            | `/(shop)/orders/[id] (completed)`   | ShopOrderDetailsDesign                               |
| `shop/CustomerOrder/CustomerOrder.dart`              | `/(shop)/customers`                 | CustomersDesign                                      |
| `shop/CustomerOrder/DeclineOrder/DeclineOrder1.dart` | `/decline-order?id=<id>`               | DeclineOrderDesign                                   |
| `shop/CustomerOrder/DeclineOrder/DeclineOrder2.dart` | `/decline-closed?id=<id>`              | DeclineOrderDesign                                   |
| `shop/CustomerOrder/DeclineOrder/DeclineOrder3.dart` | `/decline-busy?id=<id>`                | DeclineOrderDesign                                   |
| `shop/CustomerOrder/DeclineOrder/DeclineOrder4.dart` | `/decline-services?id=<id>`            | DeclineOrderDesign                                   |
| `shop/CustomerOrder/DeclineOrder/OrderDeclined.dart` | `/order-declined`                   | SuccessDesign                                        |
| `shop/CustomerOrder/ExpandCancelledOrder.dart`       | `/shop-customers?status=Cancelled`  | CustomersDesign                                      |
| `shop/CustomerOrder/ExpandCompleteOrder.dart`        | `/shop-customers?status=Completed`  | CustomersDesign                                      |
| `shop/CustomerOrder/ExpandNewOrder.dart`             | `/shop-customers?status=Pending`    | CustomersDesign                                      |
| `shop/CustomerOrder/ExpandOngoingOrder.dart`         | `/shop-customers?status=Processing` | CustomersDesign                                      |
| `shop/CustomerOrder/OngoingDetails.dart`             | `/(shop)/orders/[id] (processing)`  | ShopOrderDetailsDesign                               |
| `shop/OrderScreen/IndividualTransact.dart`           | `/shop-transaction?id=<id>`            | ShopOrderDetailsDesign (transaction)                 |
| `shop/OrderScreen/OrderScreen.dart`                  | `/(shop)/transactions`              | ShopTransactionsDesign                               |
| `shop/ProfileShop/2FAConfirm.dart`                   | `/2fa-complete`                     | TwoFactorDesign                                      |
| `shop/ProfileShop/AccDelete.dart`                    | `/account-deleted`                  | SuccessDesign                                        |
| `shop/ProfileShop/AccountInfo.dart`                  | `/account-information`              | EditProfileDesign (account)                          |
| `shop/ProfileShop/Choose2FA.dart`                    | `/choose-2fa`                       | TwoFactorDesign                                      |
| `shop/ProfileShop/DeleteAcc.dart`                    | `/delete-account`                   | AccountConfirmationDesign                            |
| `shop/ProfileShop/Enter2FA.dart`                     | `/enter-2fa`                        | TwoFactorDesign                                      |
| `shop/ProfileShop/Logout.dart`                       | `/logout`                           | AccountConfirmationDesign                            |
| `shop/ProfileShop/Security.dart`                     | `/security`                         | ChangePasswordDesign (security)                      |
| `shop/ProfileShop/ShopDetails.dart`                  | `/shop-details`                     | ShopDetailsFormDesign                                |
| `shop/ProfileShop/ShopProfile.dart`                  | `/(shop)/profile`                   | ShopProfileDesign                                    |
| `shop/Services/ServiceScreen1.dart`                  | `/(shop)/services`                  | ServicesDesign (services, pricing, add/edit dialogs) |
| `shop/ShopDashboard/homescreen.dart`                 | `/(shop)/home`                      | ShopHomeDesign                                       |
| `shop/ShopDashboard/notifpage.dart`                  | `/shop-notifications`               | NotificationsDesign (shop)                           |
| `shop/ShopDashboard/shop_map.dart`                   | `embedded dashboard map`            | LaundryMap                                           |
| `Sockets/socketService.dart`                         | `data helper`                       | socket.service.ts                                    |
| `user/authenticationuser/forgot1_user.dart`          | `/forgot-password`                  | RecoveryDesign                                       |
| `user/authenticationuser/forgot2_user.dart`          | `/verify-email`                     | RecoveryDesign                                       |
| `user/authenticationuser/forgot3_user.dart`          | `/password-reset`                   | RecoveryDesign                                       |
| `user/authenticationuser/forgot4_user.dart`          | `/new-password`                     | RecoveryDesign                                       |
| `user/authenticationuser/forgot5_user.dart`          | `/password-changed`                 | RecoveryDesign                                       |
| `user/authenticationuser/signupcomplete.dart`        | `/registration-complete`            | SuccessDesign                                        |
| `user/authenticationuser/signupscreen.dart`          | `/signup`                           | SignupDesign                                         |
| `user/authenticationuser/userdetails.dart`           | `/user-details`                     | UserDetailsDesign                                    |
| `user/Dashboard/activities_screen.dart`              | `/(user)/activities`                | ActivitiesDesign                                     |
| `user/Dashboard/allshops.dart`                       | `/(user)/shops`                     | ShopsDesign                                          |
| `user/Dashboard/laundry_dashboard_screen.dart`       | `/(user)/home`                      | UserHomeDesign                                       |
| `user/Dashboard/notifications_screen.dart`           | `/notifications`                    | NotificationsDesign                                  |
| `user/Dashboard/search_screen.dart`                  | `/search`                           | ShopsDesign (search)                                 |
| `user/Dashboard/viewmap.dart`                        | `/map`                              | ShopsDesign (map)                                    |
| `user/Dashboard/viewshopinfo.dart`                   | `/(user)/shops/[id]`                | ShopInfoDesign                                       |
| `user/History/ActiveTransact.dart`                   | `/history`                          | ActivitiesDesign (active)                            |
| `user/History/DetailTransact.dart`                   | `/transaction-details?id=<id>`         | OrderDetailsDesign (full)                            |
| `user/History/PastTransact.dart`                     | `/past-orders`                      | ActivitiesDesign (past)                              |
| `user/Location/AddLocation.dart`                     | `/add-location`                     | LocationDesign                                       |
| `user/Location/Addresses.Dart`                       | `/addresses`                        | AddressesDesign                                      |
| `user/Location/CurrentLocation.dart`                 | `/current-location`                 | LocationDesign                                       |
| `user/Location/ViewAddress.dart`                     | `no UI in source`                   | Empty Dart file                                      |
| `user/Location/ViewShopInformation.dart`             | `no UI in source`                   | Empty Dart file                                      |
| `user/Location/ViewShops.dart`                       | `/view-shops`                       | ShopsDesign (map)                                    |
| `user/OrderingSystem/laundryfulldetails.dart`        | `/shop-about?id=<id>`                  | ShopInfoDesign (about/pricing)                       |
| `user/OrderingSystem/ordershopsystem.dart`           | `/(user)/order/[shopId]`            | ShopMenuDesign                                       |
| `user/ProfileUser/AccountDelete.dart`                | `/account-deleted`                  | SuccessDesign                                        |
| `user/ProfileUser/ChangePassword.dart`               | `/change-password`                  | ChangePasswordDesign                                 |
| `user/ProfileUser/ConfirmDelete.dart`                | `/delete-account`                   | AccountConfirmationDesign                            |
| `user/ProfileUser/EditProfile.dart`                  | `/edit-profile`                     | EditProfileDesign                                    |
| `user/ProfileUser/UserProfile.dart`                  | `/(user)/profile`                   | UserProfileDesign                                    |
| `user/Transaction/1OrderConfirm.dart`                | `/(user)/order/confirm`             | OrderSummaryDesign                                   |
| `user/Transaction/2PlaceOrder.dart`                  | `/checkout`                         | CheckoutDesign + ScheduleDesign + PaymentDesign      |
| `user/Transaction/3ProceedOrder.dart`                | `/order-complete?id=<id>`              | SuccessDesign                                        |
| `user/Transaction/CancelOrder.dart`                  | `/cancel-order-confirm?id=<id>`        | CancelOrderDesign                                    |
| `user/Transaction/CancelOrder2.dart`                 | `/cancel-order?id=<id>`                | CancelOrderDesign                                    |
| `user/Transaction/CardType.dart`                     | `no UI in source`                   | Empty Dart file                                      |
| `user/Transaction/ConfirmedTranct.dart`              | `/(user)/order/tracking/[id]`       | OrderDetailsDesign                                   |
| `user/Transaction/LaundryCount.dart`                 | `/laundries`                        | LaundryCountDesign                                   |
| `user/Transaction/OrderCancelled.dart`               | `/order-cancelled`                  | SuccessDesign                                        |
| `user/Transaction/OrderDelivered.dart`               | `/order-delivered?id=<id>`             | OrderDetailsDesign (delivered)                       |
| `user/Transaction/Payment.dart`                      | `no UI in source`                   | Empty Dart file                                      |
| `user/Transaction/Schedule.dart`                     | `no UI in source`                   | Empty Dart file                                      |
| `user/Transaction/Status.dart`                       | `no UI in source`                   | Empty Dart file                                      |
| `user/Transaction/transaction_service.dart`          | `data helper`                       | design/data.ts                                       |
| `user/Transaction/Voucher.dart`                      | `/vouchers`                         | VouchersDesign                                       |
| `welcome.dart`                                       | `/welcome`                          | OnboardingScreen                                     |
