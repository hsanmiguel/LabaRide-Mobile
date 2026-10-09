export type AddressType = "Home" | "Work" | "Hotel" | "Apartment";
export interface AddressData {
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state_province?: string | null;
  postal_code?: string | null;
  country?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  address_type?: AddressType | null;
  access_code?: string | null;
  dropoff_instructions?: string | null;
  // Display historical addresses until their owner supplies the new fields.
  zone?: string | null;
  street?: string | null;
  barangay?: string | null;
  building?: string | null;
  address?: string | null;
}
export const addressKeys = [
  "address_line_1", "address_line_2", "city", "state_province", "postal_code",
  "country", "address_type", "access_code", "dropoff_instructions",
] as const;
export function addressValues(value?: AddressData | null, type: AddressType = "Home"): Record<string, string> {
  return Object.fromEntries(addressKeys.map(key => [key,
    String(value?.[key] ?? (key === "country" ? "Philippines" : key === "address_type" ? type : "")),
  ]));
}
export function addressError(value?: AddressData | Record<string, string> | null): string | null {
  const labels = {
    address_line_1: "Street number and street name", city: "City or municipality",
    state_province: "State, province, or region", postal_code: "ZIP or postal code", country: "Country",
  };
  for (const [key, label] of Object.entries(labels)) {
    if (!String(value?.[key as keyof AddressData] ?? "").trim()) return `${label} is required.`;
  }
  if (!["Home", "Work", "Hotel", "Apartment"].includes(String(value?.address_type))) {
    return "Choose an address type: Home, Work, Hotel, or Apartment.";
  }
  return null;
}
export function addressPayload(value: AddressData | Record<string, string>) {
  return {
    address_line_1: String(value.address_line_1 ?? "").trim(),
    address_line_2: String(value.address_line_2 ?? "").trim(),
    city: String(value.city ?? "").trim(),
    state_province: String(value.state_province ?? "").trim(),
    postal_code: String(value.postal_code ?? "").trim(),
    country: String(value.country ?? "").trim(),
    address_type: value.address_type as AddressType,
    access_code: String(value.access_code ?? "").trim(),
    dropoff_instructions: String(value.dropoff_instructions ?? "").trim(),
  };
}
export function formatAddress(value?: AddressData | null) {
  if (value?.address_line_1) {
    return [value.address_line_1, value.address_line_2, value.city, value.state_province,
    value.postal_code, value.country].filter(Boolean).join(", ");
  }
  return value?.address || [value?.building, value?.zone, value?.street, value?.barangay].filter(Boolean).join(", ");
}
