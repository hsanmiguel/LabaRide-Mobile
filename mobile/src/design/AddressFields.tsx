import { useState, type Dispatch, type SetStateAction } from "react";
import * as Location from "expo-location";
import { View } from "react-native";
import { Button, Choice, Field, Section, Txt, usePalette, styles } from "./ui";
import LaundryMap from "./LaundryMap";
import { coordinates } from "./discovery";
import type { AddressData } from "./address";
import { reverseGeocodeCoordinates } from "./geocoding";

export function DeliveryDetails({ value }: { value: AddressData }) {
  return (
    <View style={{ gap: 6, marginVertical: 8 }}>
      {!!value.address_type && <Txt style={styles.muted}>Address type: {value.address_type}</Txt>}
      {!!value.access_code && <Txt>Access code: {value.access_code}</Txt>}
      {!!value.dropoff_instructions && <Txt>Dropoff instructions: {value.dropoff_instructions}</Txt>}
    </View>
  );
}

export function FormError({ error }: { error?: string | null }) {
  const palette = usePalette();
  if (!error) return null;
  return <View accessibilityRole="alert" accessibilityLiveRegion="assertive"
    style={{ padding: 14, borderRadius: 10, backgroundColor: "#FFF1F2", marginVertical: 12 }}>
    <Txt style={{ color: palette.danger }}>{error}</Txt>
  </View>;
}
export function AddressFields({ values, setValues }: {
  values: Record<string, string>;
  setValues: Dispatch<SetStateAction<Record<string, string>>>;
}) {
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const point = coordinates(values);

  async function handlePin(coordinate: { latitude: number; longitude: number }) {
    setValues(current => ({
      ...current,
      latitude: String(coordinate.latitude),
      longitude: String(coordinate.longitude),
    }));
    try {
      const geo = await reverseGeocodeCoordinates(coordinate.latitude, coordinate.longitude);
      setValues(current => ({
        ...current,
        latitude: String(coordinate.latitude),
        longitude: String(coordinate.longitude),
        ...(geo.address_line_1 ? { address_line_1: geo.address_line_1 } : {}),
        ...(geo.city ? { city: geo.city } : {}),
        ...(geo.state_province ? { state_province: geo.state_province } : {}),
        ...(geo.postal_code ? { postal_code: geo.postal_code } : {}),
        ...(geo.country ? { country: geo.country } : {}),
      }));
    } catch {
      // Retain coordinates even if reverse geocoding is unavailable
    }
  }

  async function locate() {
    setLocating(true);
    setLocationError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setLocationError("Location access is off. You can still enter your address manually.");
        return;
      }
      const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = result.coords.latitude;
      const lng = result.coords.longitude;
      const geo = await reverseGeocodeCoordinates(lat, lng);
      setValues(current => ({
        ...current,
        latitude: String(lat),
        longitude: String(lng),
        ...(geo.address_line_1 ? { address_line_1: geo.address_line_1 } : {}),
        ...(geo.city ? { city: geo.city } : {}),
        ...(geo.state_province ? { state_province: geo.state_province } : {}),
        ...(geo.postal_code ? { postal_code: geo.postal_code } : {}),
        ...(geo.country ? { country: geo.country } : {}),
      }));
    } catch {
      setLocationError("Could not find your location. Please try again or enter your address manually.");
    } finally {
      setLocating(false);
    }
  }
  return <View>
    <Txt style={[styles.muted, { marginBottom: 12 }]}>Fields marked * are required.</Txt>
    {[
      ["address_line_1", "Address line 1 *", "Street number and street name"],
      ["address_line_2", "Address line 2 (optional)", "Suite, unit, apartment, or room"],
      ["city", "City / Municipality *", "City or municipality"],
      ["state_province", "State / Province / Region *", "State, province, or region"],
      ["postal_code", "ZIP / Postal code *", "ZIP or postal code"],
      ["country", "Country *", "Country"],
    ].map(([key, label, placeholder]) => <Field key={key} label={label} placeholder={placeholder}
      value={values[key] || ""} onChangeText={text => setValues(current => ({ ...current, [key]: text }))} />)}
    <Section title="Map location (optional)" />
    <Txt style={[styles.muted, { marginBottom: 12 }]}>If you are at this address, save your current position to help locate nearby shops. Check that it matches the address above.</Txt>
    <Button title={point ? "Update current position" : "Use current position"} outline busy={locating} onPress={locate} />
    <FormError error={locationError} />
    <View style={{ height: 240, marginVertical: 16, borderRadius: 12, overflow: "hidden" }}>
      <LaundryMap latitude={point?.latitude ?? 13.6217} longitude={point?.longitude ?? 123.1948} onPin={handlePin} />
    </View>
    <Section title="Address type *" />
    <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 16, gap: 12 }}>
      {["Home", "Work", "Hotel", "Apartment"].map(type => <View key={type} style={{ width: "45%" }}><Choice label={type}
        selected={values.address_type === type} onPress={() => setValues(current => ({ ...current, address_type: type }))} /></View>)}
    </View>
    <Field label="Access code (optional)" placeholder="Gate code, intercom number, or buzzer"
      value={values.access_code || ""} onChangeText={text => setValues(current => ({ ...current, access_code: text }))} />
    <Field label="Dropoff instructions (optional)" placeholder="Leave with doorman, porch pickup, etc." multiline
      style={{ minHeight: 90, textAlignVertical: "top" }}
      value={values.dropoff_instructions || ""} onChangeText={text => setValues(current => ({ ...current, dropoff_instructions: text }))} />
  </View>;
}
