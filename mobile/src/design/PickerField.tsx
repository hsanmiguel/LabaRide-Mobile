// Metro resolves PickerField.web.tsx in the browser and this component on native platforms.
import { useState } from "react";
import { Modal, Platform, Pressable, View } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { CalendarDays, Clock } from "lucide-react-native";
import type { PickerFieldProps } from "./PickerField.types";
import { displayTime, localDateString, timeInputValue } from "./form-values";
import { Button, Card, Txt, palette, styles } from "./ui";

export default function PickerField({ label, mode, value, onChange, initialValue, maximumDate }: PickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(new Date());
  function selectedDate() {
    if (mode === "date") {
      const selected = new Date(`${value || initialValue || "2000-01-01"}T12:00:00`);
      return Number.isFinite(selected.getTime()) ? selected : new Date(2000, 0, 1, 12);
    }
    const [hour, minute] = (timeInputValue(value || initialValue || "08:00") || "08:00").split(":").map(Number);
    const selected = new Date();
    selected.setHours(hour, minute, 0, 0);
    return selected;
  }
  function commit(date: Date) {
    onChange(mode === "date" ? localDateString(date) :
      displayTime(`${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`));
  }
  function show() {
    const selected = selectedDate();
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({ value: selected, mode, maximumDate, is24Hour: false,
        onValueChange: (_, date) => commit(date) });
    } else {
      setDraft(selected);
      setOpen(true);
    }
  }
  const Icon = mode === "date" ? CalendarDays : Clock;
  return (
    <View style={{ gap: 8, marginBottom: 16 }}>
      <Txt style={{ color: "#545454" }}>{label}</Txt>
      <Pressable accessibilityRole="button" accessibilityLabel={label}
        accessibilityValue={{ text: value || "Not selected" }} onPress={show}
        style={{ minHeight: 50, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: "#F1F1F1",
          backgroundColor: "#FAFAFA", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Txt style={{ color: value ? palette.ink : palette.muted }}>{value || (mode === "date" ? "Select date" : "Select time")}</Txt>
        <Icon size={20} color={palette.navy} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "#00000066", justifyContent: "center", padding: 20 }}>
          <Card>
            <Txt style={styles.heading}>{label}</Txt>
            {open && <DateTimePicker value={draft} mode={mode} display="spinner" maximumDate={maximumDate}
              themeVariant="light" onValueChange={(_, date) => setDraft(date)} />}
            <View style={styles.row}>
              <Button title="Cancel" outline onPress={() => setOpen(false)} style={styles.grow} />
              <Button title="Done" onPress={() => { commit(draft); setOpen(false); }} style={styles.grow} />
            </View>
          </Card>
        </View>
      </Modal>
    </View>
  );
}
