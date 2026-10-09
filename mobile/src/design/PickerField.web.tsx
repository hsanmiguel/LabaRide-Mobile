import { useId, useRef } from "react";
import { View } from "react-native";
import type { PickerFieldProps } from "./PickerField.types";
import { displayTime, localDateString, timeInputValue } from "./form-values";
import { Txt, palette } from "./ui";

export default function PickerField({ label, mode, value, onChange, maximumDate }: PickerFieldProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  return (
    <View style={{ gap: 8, marginBottom: 16 }}>
      <label htmlFor={id} style={{ color: "#545454", fontFamily: "Inter", fontSize: 14 }}>{label}</label>
      <input
        ref={input}
        id={id}
        aria-label={label}
        type={mode}
        value={mode === "date" ? value.slice(0, 10) : timeInputValue(value)}
        max={mode === "date" && maximumDate ? localDateString(maximumDate) : undefined}
        step={mode === "time" ? 60 : undefined}
        onChange={event => onChange(mode === "time" ? displayTime(event.currentTarget.value) : event.currentTarget.value)}
        onClick={() => {
          // Open the browser picker from the whole input, including its keyboard-accessible native control.
          try { input.current?.showPicker?.(); } catch { /* The native indicator remains available. */ }
        }}
        style={{ boxSizing: "border-box", width: "100%", minWidth: 0, minHeight: 50,
          padding: "14px 16px", fontFamily: "Inter", fontSize: 14, color: palette.ink,
          backgroundColor: "#FAFAFA", border: "1px solid #F1F1F1", borderRadius: 12 }}
      />
      {mode === "time" && !!value && <Txt style={{ fontSize: 12, color: palette.muted }}>{displayTime(value)}</Txt>}
    </View>
  );
}
