import type { AddressData } from "./address";

export function coordinates(value?: AddressData | null) {
  if (value?.latitude == null || value.longitude == null || value.latitude === "" || value.longitude === "") return null;
  const latitude = Number(value.latitude), longitude = Number(value.longitude);
  return Number.isFinite(latitude) && Math.abs(latitude) <= 90 && Number.isFinite(longitude) && Math.abs(longitude) <= 180
    ? { latitude, longitude } : null;
}
export function nearestShops<T extends AddressData>(shops: T[], origin?: AddressData | null) {
  const from = coordinates(origin);
  if (!from) return [];
  const radians = (degrees: number) => degrees * Math.PI / 180;
  return shops.flatMap(shop => {
    const to = coordinates(shop);
    if (!to) return [];
    const a = Math.sin(radians(to.latitude - from.latitude) / 2) ** 2 + Math.cos(radians(from.latitude)) *
      Math.cos(radians(to.latitude)) * Math.sin(radians(to.longitude - from.longitude) / 2) ** 2;
    return [{ shop, distance: 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a))) }];
  }).sort((a, b) => a.distance - b.distance);
}

export function cleanCity(city?: string | null) {
  if (!city) return "";
  return city
    .toLowerCase()
    .replace(/\bcity\b/g, "")
    .replace(/[^\w\s]/g, "")
    .trim();
}

export function nearbyShops<T extends AddressData>(
  shops: T[],
  origin?: AddressData | null,
  maxDistanceKm = 15,
) {
  const ranked = nearestShops(shops, origin);
  const userCity = cleanCity(origin?.city);

  return ranked.filter(({ shop, distance }) => {
    // 1. Same city/municipality match
    if (userCity) {
      const shopCity = cleanCity(shop.city || shop.barangay || shop.address);
      if (shopCity && (shopCity.includes(userCity) || userCity.includes(shopCity))) {
        return true;
      }
    }
    // 2. Maximum reasonable delivery distance threshold (15 km)
    return distance <= maxDistanceKm;
  });
}
