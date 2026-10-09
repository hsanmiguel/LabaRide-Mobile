# Test login in Expo Go

The phone connects to the Express backend, which connects to Supabase. For this
computer, `mobile/.env` currently uses `EXPO_PUBLIC_API_URL=http://192.168.1.113:5000`.

1. Keep the phone and computer on the same Wi-Fi.
2. Open `http://192.168.1.113:5000/health` in the phone's browser. It should show
   `{"status":"ok"}`. If this fails, check the backend process, Wi-Fi isolation,
   VPN, and the firewall rule for Node.js/port 5000.
3. In the backend terminal, run `npm.cmd run dev` from `server` if it is not
   already running.
4. Stop the existing Expo process with Ctrl+C. From `mobile`, run
   `npm.cmd run start:phone`. This starts Expo Go in LAN mode and clears Metro's
   cache. Scan the new QR code.
5. Fully close Expo Go and reopen the project. A fast refresh can retain the old
   environment value; changes to `.env` need a full reload.
6. Try login. If it fails, copy the full new error, which now includes the API
   address used by the app. A server response about credentials is different
   from a network failure.

During this diagnosis the phone could open `/health`, but the Android bundle
served by the existing Expo process still contained `localhost:5000`, even
though `mobile/.env` had the correct LAN URL. On a physical phone localhost
refers to the phone.

Native development now falls back to the private LAN host in
`Constants.expoConfig.hostUri` when its API configuration is missing or points
to localhost. Explicit LAN, emulator, and hosted backend URLs remain in effect.
The API and Socket.IO share the resolved address. Web and production do not use
this development fallback. If the Wi-Fi IP changes, update `mobile/.env`.

Expo's tunnel exposes Metro, not your Express backend on port 5000. If you use
a tunnel or different networks, configure a backend URL reachable by the phone.
Changing `app.json` network permissions does not change the installed Expo Go
binary.

Run `npm.cmd run test:network` and `npm.cmd run typecheck` from `mobile` to check
the URL resolver and error reporting.
