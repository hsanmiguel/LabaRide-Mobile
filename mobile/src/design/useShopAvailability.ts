import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { shopAvailability, type ShopHours } from "./shop-hours";

export function useShopAvailability(shop?: ShopHours | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = setInterval(refresh, 1000);
    const listener = AppState.addEventListener("change", state => { if (state === "active") refresh(); });
    return () => { clearInterval(timer); listener.remove(); };
  }, []);
  return shopAvailability(shop, now);
}
