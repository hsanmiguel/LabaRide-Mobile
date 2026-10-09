# Date, time, and password confirmation inputs

Birthdate has a calendar picker in personal registration details and Edit Profile. Dates stay as `YYYY-MM-DD`, using the selected calendar day rather than converting it to UTC. The picker and form prevent future birthdates, and the server validates calendar dates, including leap days.

Shop registration and Shop Details use separate opening and closing time pickers. Times are displayed and saved as `h:mm AM/PM`, retaining compatibility with existing business hours. Both 12-hour and 24-hour existing values are recognized. Overnight business hours are allowed.

The browser uses built-in HTML date/time controls; Android uses system picker dialogs; iOS uses a picker with Cancel and Done. The native dependency is pinned to `@react-native-community/datetimepicker` 9.1.0, matching the installed Expo SDK 57 compatibility list and the [Expo SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/sdk/date-time-picker/). Its config plugin is included in `app.json`.

Signup requires Confirm Password. Empty or mismatched confirmation is shown on the form and rejected before a request. The API independently verifies an exact match. Confirmation is never stored in the database.

To reload after updating dependencies, restart the mobile development server:

```powershell
cd mobile
npm.cmd run web -- --clear
```

Custom native development builds need to include the newly installed native dependency. Expo Go SDK 57 already includes this picker.

Checks:

```powershell
# server/
npm.cmd run test:forms
npm.cmd run test:shop:integration

# mobile/
npm.cmd run typecheck
```

Form regression tests cover confirmation matching, invalid calendar dates, leap days, future birthdates, timezone-safe formatting, midnight/noon conversions, and existing/overnight business hours. The live integration test validates signup confirmation and saving birthdates and business hours through Supabase, then rolls back its fixtures.
