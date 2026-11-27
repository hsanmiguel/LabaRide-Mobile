import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
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
    style={{ padding: 14, borderRadius: 10, backgroundColor: palette.dangerSoft, marginVertical: 12 }}>
    <Txt style={{ color: palette.danger }}>{error}</Txt>
  </View>;
}
export function AddressFields({ values, setValues, requirePin = false, columns = 1 }: {
  values: Record<string, string>;
  setValues: Dispatch<SetStateAction<Record<string, string>>>;
  requirePin?: boolean;
  columns?: 1 | 2;
}) {
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const point = coordinates(values);
  const locationRequest = useRef(0);
  useEffect(() => () => { ++locationRequest.current; }, []);
  function changeAddress(key: string, text: string) {
    const changesLocation = key !== 'address_line_2' && text.trim().toLowerCase() !== (values[key] || '').trim().toLowerCase();
    if (changesLocation) {
      ++locationRequest.current; setLocating(false);
      if (point) setLocationError('Your address changed. Move the pin to the new address before saving. If you only corrected the text, confirm that the existing pin still matches.');
    }
    setValues(current => ({ ...current, [key]: text,
      ...(changesLocation && point ? { pinNeedsConfirmation: 'true' } : {}),
    }));
  }

  async function handlePin(coordinate: { latitude: number; longitude: number }) {
    const request = ++locationRequest.current;
    setLocationError(null);
    setLocating(false);
    setValues(current => ({
      ...current,
      latitude: String(coordinate.latitude),
      longitude: String(coordinate.longitude),
      pinNeedsConfirmation: 'false',
    }));
    try {
      const geo = await reverseGeocodeCoordinates(coordinate.latitude, coordinate.longitude);
      if (request !== locationRequest.current) return;
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
    const request = ++locationRequest.current;
    setLocating(true);
    setLocationError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (request !== locationRequest.current) return;
      if (permission.status !== "granted") {
        setLocationError("Location access is off. You can still enter your address manually.");
        return;
      }
      const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (request !== locationRequest.current) return;
      const lat = result.coords.latitude;
      const lng = result.coords.longitude;
      // A working GPS fix must not depend on address lookup/network success.
      setValues(current => ({ ...current, latitude: String(lat), longitude: String(lng), pinNeedsConfirmation: 'false' }));
      let geo: Awaited<ReturnType<typeof reverseGeocodeCoordinates>>;
      try { geo = await reverseGeocodeCoordinates(lat, lng); }
      catch { return; }
      if (request !== locationRequest.current) return;
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
      if (request === locationRequest.current) setLocationError("Could not find your location. Place the map pin at your address or try again.");
    } finally {
      if (request === locationRequest.current) setLocating(false);
    }
  }
  if (columns === 2) return <View testID="compact-shop-address" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 24 }}>
    <View style={{ flex: 1.15, minWidth: 0, gap: 12 }}>
      <Txt style={{ fontSize: 11, color: '#626B7D' }}>Fields marked * are required.</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{[
        ['address_line_1', 'Address line 1 *', 'Street number and street name'],
        ['address_line_2', 'Address line 2 (optional)', 'Suite, unit, apartment, or room'],
        ['city', 'City / Municipality *', 'City or municipality'],
        ['state_province', 'State / Province / Region *', 'State, province, or region'],
        ['postal_code', 'ZIP / Postal code *', 'ZIP or postal code'],
        ['country', 'Country *', 'Country'],
      ].map(([key, label, placeholder]) => <View key={key} style={{ flexBasis: '47%', flexGrow: 1, minWidth: 0 }}><Field compact label={label} placeholder={placeholder} value={values[key] || ''} onChangeText={text => setValues(current => ({ ...current, [key]: text }))} /></View>)}</View>
      <View style={{ gap: 4 }}><Txt style={{ fontSize: 12, fontWeight: '600' }}>Address type *</Txt><View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 16 }}>{['Home', 'Work', 'Hotel', 'Apartment'].map(type => <Choice key={type} label={type} selected={values.address_type === type} onPress={() => setValues(current => ({ ...current, address_type: type }))} />)}</View></View>
      <Field compact label="Access code (optional)" placeholder="Gate code, intercom number, or buzzer" value={values.access_code || ''} onChangeText={access_code => setValues(current => ({ ...current, access_code }))} />
    </View>
    <View style={{ flex: 1, minWidth: 0, gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}><Txt style={{ fontSize: 13, fontWeight: '600', flex: 1 }}>Map location (optional)</Txt><Button title={point ? 'Update current position' : 'Use current position'} compact outline busy={locating} onPress={locate} /></View>
      <Txt style={{ fontSize: 12, lineHeight: 18, color: '#626B7D' }}>Pin your shop or use your current position. Check that the pin matches the address.</Txt>
      <FormError error={locationError} />
      <View style={{ height: 185, borderRadius: 10, overflow: 'hidden' }}><LaundryMap latitude={point?.latitude ?? 13.6217} longitude={point?.longitude ?? 123.1948} onPin={handlePin} /></View>
      <Field compact label="Dropoff instructions (optional)" placeholder="Entry details or instructions for the rider" multiline style={{ minHeight: 64, textAlignVertical: 'top' }} value={values.dropoff_instructions || ''} onChangeText={dropoff_instructions => setValues(current => ({ ...current, dropoff_instructions }))} />
    </View>
  </View>;
  return <View>
    <Txt style={[styles.muted, { marginBottom: 12 }]}>Fields marked * are required.</Txt>
    <View>{[
      ["address_line_1", "Address line 1 *", "Street number and street name"],
      ["address_line_2", "Address line 2 (optional)", "Suite, unit, apartment, or room"],
      ["city", "City / Municipality *", "City or municipality"],
      ["state_province", "State / Province / Region *", "State, province, or region"],
      ["postal_code", "ZIP / Postal code *", "ZIP or postal code"],
      ["country", "Country *", "Country"],
    ].map(([key, label, placeholder]) => <Field key={key} label={label} placeholder={placeholder}
      value={values[key] || ""} onChangeText={text => changeAddress(key, text)} />)}</View>
    <Section title={requirePin ? 'Map location *' : 'Map location (optional)'} />
    <Txt style={[styles.muted, { marginBottom: 12 }]}>{requirePin ? 'Place the pin at this address so we can check pickup and delivery distances. If you are there now, you can use your current position.' : 'If you are at this address, save your current position to help locate nearby shops. Check that it matches the address above.'}</Txt>
    <Button title={point ? "Update current position" : "Use current position"} outline busy={locating} onPress={locate} />
    <Txt style={[styles.muted, { marginTop: 8 }]}>Current position uses your device's GPS. For an address somewhere else, tap that location on the map instead.</Txt>
    {point && values.pinNeedsConfirmation === 'true' && <Button title="Confirm existing pin matches this address" outline onPress={() => {
      setValues(current => ({ ...current, pinNeedsConfirmation: 'false' }));
      setLocationError(null);
    }} />}
    {!!point && <Txt style={[styles.muted, { marginTop: 10 }]}>Map pin: {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}. Check that this is the delivery address before saving.</Txt>}
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
