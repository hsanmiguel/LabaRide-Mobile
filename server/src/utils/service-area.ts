type Point = { latitude?: unknown; longitude?: unknown };
export type ServiceArea = Point & {
  deliveryMinKm?: unknown; deliveryMaxKm?: unknown;
  pickupMinKm?: unknown; pickupMaxKm?: unknown;
  pickupEnabled?: boolean;
};
export const distanceFields = ["deliveryMinKm", "deliveryMaxKm", "pickupMinKm", "pickupMaxKm"] as const;

function numeric(value: unknown) {
  return value == null || value === "" ? null : Number(value);
}
function point(value?: Point | null) {
  const latitude = numeric(value?.latitude), longitude = numeric(value?.longitude);
  return latitude !== null && longitude !== null && Number.isFinite(latitude) && Math.abs(latitude) <= 90
    && Number.isFinite(longitude) && Math.abs(longitude) <= 180 ? { latitude, longitude } : null;
}
export function distanceKm(from?: Point | null, to?: Point | null) {
  const a = point(from), b = point(to);
  if (!a || !b) return null;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const h = Math.sin(radians(b.latitude - a.latitude) / 2) ** 2
    + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude))
    * Math.sin(radians(b.longitude - a.longitude) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(Math.min(1, h)), Math.sqrt(Math.max(0, 1 - h)));
}
export function distanceSettingsError(shop: ServiceArea) {
  for (const field of distanceFields) {
    const value = numeric(shop[field]);
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 99999.99
      || Number(value.toFixed(2)) !== value || (field.endsWith("MaxKm") && value === 0))) {
      return "Enter distances in km with up to two decimal places. Minimums may be 0; maximums must be above 0.";
    }
  }
  for (const mode of ["delivery", "pickup"] as const) {
    const min = numeric(shop[mode === "delivery" ? "deliveryMinKm" : "pickupMinKm"]) ?? 0;
    const max = numeric(shop[mode === "delivery" ? "deliveryMaxKm" : "pickupMaxKm"]);
    if (max !== null && min > max) return `The ${mode} minimum distance cannot exceed its maximum.`;
  }
  if ((shop.pickupEnabled || distanceFields.some(field => numeric(shop[field]) !== null)) && !point(shop)) {
    return "Pin the shop location on the map before setting distance rules or offering laundry collection.";
  }
  return null;
}
export function serviceAreaError(shop: ServiceArea, address: Point | null | undefined, mode: "delivery" | "pickup") {
  if (mode === "pickup" && !shop.pickupEnabled) return "This shop does not offer laundry collection.";
  const min = numeric(shop[mode === "delivery" ? "deliveryMinKm" : "pickupMinKm"]);
  const max = numeric(shop[mode === "delivery" ? "deliveryMaxKm" : "pickupMaxKm"]);
  if (min === null && max === null) return null;
  if (!point(shop)) return "The shop needs a pinned map location before this service can be booked.";
  const distance = distanceKm(shop, address);
  if (distance === null) return `Pin your ${mode === "pickup" ? "collection" : "delivery"} address on the map to check this shop's service area.`;
  if (min !== null && distance + 1e-9 < min) return `This shop's minimum ${mode} distance is ${min} km. Your address is ${distance.toFixed(2)} km away.`;
  if (max !== null && distance - 1e-9 > max) return `This shop's maximum ${mode} distance is ${max} km. Your address is ${distance.toFixed(2)} km away.`;
  return null;
}
export function serviceAreaLabel(shop: ServiceArea, mode: "delivery" | "pickup") {
  const min = numeric(shop[mode === "delivery" ? "deliveryMinKm" : "pickupMinKm"]) ?? 0;
  const max = numeric(shop[mode === "delivery" ? "deliveryMaxKm" : "pickupMaxKm"]);
  return max !== null ? `${min}–${max} km` : min > 0 ? `At least ${min} km` : "No distance limit";
}
