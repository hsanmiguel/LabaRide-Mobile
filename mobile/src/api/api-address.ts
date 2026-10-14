type ApiAddressOptions = {
  configuredUrl?: string;
  platform: string;
  development: boolean;
  expoHostUri?: string;
};

function localDevelopmentHost(hostUri?: string) {
  if (!hostUri) return undefined;
  try {
    const host = new URL(hostUri.includes("://") ? hostUri : `http://${hostUri}`).hostname;
    // An Expo tunnel forwards Metro, not the backend on port 5001.
    return /^(10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})$/.test(host)
      ? host : undefined;
  } catch {
    return undefined;
  }
}

export function resolveApiUrl(options: ApiAddressOptions) {
  const configured = options.configuredUrl?.trim().replace(/\/+$/, "");
  const fallback = "http://localhost:5001";
  if (options.platform === "web" || !options.development) return configured || fallback;

  const localHost = localDevelopmentHost(options.expoHostUri);
  if (!localHost) return configured || fallback;
  if (!configured) return `http://${localHost}:5001`;

  try {
    const url = new URL(configured);
    if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
      url.hostname = localHost;
      return url.toString().replace(/\/+$/, "");
    }
  } catch {
    // Preserve explicit configuration so an invalid URL is reported to the user.
  }
  return configured;
}

export function connectionErrorMessage(apiUrl: string, timeout = false, platform = "native") {
  let address = "the configured backend";
  let healthAddress = "the backend health URL";
  try {
    const url = new URL(apiUrl);
    // Report the destination without credentials or query parameters.
    address = url.origin + url.pathname.replace(/\/+$/, "");
    healthAddress = `${address}/health`;
  } catch {
    return "The backend URL is invalid. Set EXPO_PUBLIC_API_URL in mobile/.env and " +
      (platform === "web" ? "restart Expo and refresh this page." : "fully reload Expo Go.");
  }
  return `${timeout ? "The server did not respond in time" : "Cannot connect to the server"} at ${address}. ` +
    (platform === "web"
      ? `Open ${healthAddress} in your browser. Make sure the backend is running; after changing mobile/.env, restart Expo with a cleared cache and refresh this page.`
      : `Open ${healthAddress} in your phone's browser. If it works, close Expo Go and reopen the project from the new QR code.`);
}
