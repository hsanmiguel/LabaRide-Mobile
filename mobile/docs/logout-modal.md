# Logout confirmation

Customer, shop, and admin logout controls call `useLogout` on the current screen. They do not push a confirmation route. Old `/logout` links return to the corresponding profile instead of rendering the former logout page. Account deletion remains a separate flow.

The shared `AppDialogHost` displays the message **Are you sure you want to log out?**, with **Cancel** and **Log Out** actions. It reuses the app's buttons, typography, role colors, and dialog service. A native logout icon, rounded card, slightly darkened blur, and short fade/scale transitions are used. Reduced-motion preferences disable the transition.

Cancel, the close button, backdrop taps, Escape on web, and Android's native back button all resolve the confirmation without changing the route, credentials, query cache, or current screen state. Web focus starts on Cancel, remains within the modal, and returns to the trigger when closed.

Confirming keeps the modal open in a busy state while the existing auth-store logout completes. It then cancels pending queries, clears the query cache, disconnects the socket, and replaces the route with login. Failed credential removal restores the saved session when possible and keeps the modal open with an error and a retry action. Repeated presses cannot submit twice. Dismissal is disabled while logout is committing.

Blur uses the SDK-matched `expo-blur` dependency. The app navigator is wrapped once in `BlurTargetView`, and its ref is passed to Android's `BlurView`; iOS and web use the regular blur view. This follows [Expo's SDK 57 blur setup](https://docs.expo.dev/versions/v57.0.0/sdk/blur-view/). Custom native development builds must include the new native dependency; rebuild an existing development client before checking it on a device.

## Verification

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build:web
npm.cmd run test:ui -- --logout
npm.cmd run test:ui -- --dialogs
```

The browser test uses isolated fixtures at 320, 390, 768, and 1440 pixels. It checks actual blur styles, current-page cancellation, credentials and history, keyboard focus, Escape, backdrop dismissal, storage failure and retry, successful redirection, and admin filter preservation. Unit tests cover async ordering, storage rollback, duplicate submission, and the production modal's Android `onRequestClose` handler. Native visual rendering and hardware back-button behavior still require a device check.
