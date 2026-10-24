import * as Location from "expo-location";

export interface GeocodedAddress {
  address_line_1?: string;
  city?: string;
  state_province?: string;
  postal_code?: string;
  country?: string;
}

/**
 * Reverse-geocodes latitude and longitude coordinates into structured address fields
 * (Street Address, City/Municipality, Province/State, Postal Code, Country).
 * Uses Mapbox Geocoding with a fallback to expo-location native geocoding.
 */
export async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number,
): Promise<GeocodedAddress> {
  const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

  // 1. Try Mapbox Geocoding API first for high accuracy
  if (token) {
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${token}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const primary = data.features?.[0];
        if (primary) {
          const result: GeocodedAddress = {};
          if (primary.place_type?.includes("address")) {
            const streetNumber = primary.address ? `${primary.address} ` : "";
            result.address_line_1 = `${streetNumber}${primary.text || ""}`.trim();
          } else if (primary.text) {
            result.address_line_1 = primary.text;
          }

          let placeName = "";
          let localityName = "";
          for (const ctx of primary.context || []) {
            const id = ctx.id || "";
            if (id.startsWith("postcode") && !result.postal_code) {
              result.postal_code = ctx.text;
            } else if (id.startsWith("place")) {
              placeName = ctx.text;
            } else if (id.startsWith("locality") || id.startsWith("neighborhood")) {
              localityName = ctx.text;
            } else if (id.startsWith("region") && !result.state_province) {
              result.state_province = ctx.text;
            } else if (id.startsWith("country") && !result.country) {
              result.country = ctx.text;
            }
          }

          result.city = placeName || localityName || "";
          if (
            localityName &&
            result.address_line_1 &&
            !result.address_line_1.includes(localityName)
          ) {
            result.address_line_1 = `${result.address_line_1}, ${localityName}`;
          }

          if (Object.keys(result).length > 0) {
            return result;
          }
        }
      }
    } catch {
      // Fall through to native reverse geocoding
    }
  }

  // 2. Fallback to native expo-location reverseGeocodeAsync
  try {
    const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (addresses && addresses.length > 0) {
      const addr = addresses[0];
      const streetPart = [addr.streetNumber, addr.street || addr.name]
        .filter(Boolean)
        .join(" ");
      return {
        address_line_1: streetPart || addr.name || addr.district || undefined,
        city: addr.city || addr.subregion || addr.district || undefined,
        state_province: addr.region || undefined,
        postal_code: addr.postalCode || undefined,
        country: addr.country || "Philippines",
      };
    }
  } catch {
    // Both failed
  }

  return {};
}
