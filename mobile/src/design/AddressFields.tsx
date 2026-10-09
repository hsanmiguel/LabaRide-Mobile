import { type Dispatch, type SetStateAction } from "react";
import { View } from "react-native";
import { Choice, Field, Section, Txt, palette, styles } from "./ui";
import type { AddressData } from "./address";

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
