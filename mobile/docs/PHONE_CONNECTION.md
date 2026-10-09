# Test login in Expo Go

The phone connects to the Express backend, which connects to Supabase.
Keep `EXPO_PUBLIC_API_URL=http://localhost:5001` in `mobile/.env` for local browser
testing and Expo Go in LAN mode. Native development replaces localhost with
Expo's current LAN address automatically, so a Wi-Fi IP change does not leave
the app pointing at an old address.

1. Keep the phone and computer on the same Wi-Fi.
2. Run `ipconfig` on the computer and find the active Wi-Fi adapter's IPv4 address.
   Open `http://<current-Wi-Fi-IP>:5001/health` in the phone's browser. It should show
   `{"status":"ok"}`. If this fails, check the backend process, Wi-Fi isolation,
   VPN, and the firewall rule for Node.js/port 5001.
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

For a browser on this computer, check `http://localhost:5001/health`. An explicit
LAN address can stop working when the computer's Wi-Fi IP changes. On a physical
phone, localhost refers to the phone; the native development resolver converts
the default URL to the computer's address before making requests.

Native development now falls back to the private LAN host in
`Constants.expoConfig.hostUri` when its API configuration is missing or points
to localhost. Explicit LAN, emulator, and hosted backend URLs remain in effect.
The API and Socket.IO share the resolved address. Web and production do not use
this development fallback. If you manually set a LAN IP in `mobile/.env`, update
that explicit address when the Wi-Fi IP changes.

Expo's tunnel exposes Metro, not your Express backend on port 5001. If you use
a tunnel or different networks, configure a backend URL reachable by the phone.
Changing `app.json` network permissions does not change the installed Expo Go
binary.

Run `npm.cmd run test:network` and `npm.cmd run typecheck` from `mobile` to check
the URL resolver and error reporting.
