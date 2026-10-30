import { useRef, useState } from "react";
import { View } from "react-native";
import { Txt, usePalette } from "./ui";

export interface WeightRangeProps { minimum: number; maximum: number; disabled?: boolean; onChange: (minimum: number, maximum: number) => void }

export default function WeightRangeSlider({ minimum, maximum, disabled, onChange }: WeightRangeProps) {
  const palette = usePalette();
  const [width, setWidth] = useState(180);
  const drag = useRef({ start: 0, value: 0 });
  function update(handle: "minimum" | "maximum", value: number) {
    if (disabled) return;
    if (handle === "minimum") onChange(Math.max(1, Math.min(maximum - 1, Math.round(value))), maximum);
    else onChange(minimum, Math.min(12, Math.max(minimum + 1, Math.round(value))));
  }
  return <View style={{ gap: 8 }}>
    <Txt style={{ fontSize: 12, fontWeight: "500" }}>Weight range (kg)</Txt>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ padding: 8, borderRadius: 9, backgroundColor: palette.surface }}><Txt style={{ fontWeight: "700" }}>{minimum} kg</Txt></View>
      <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ flex: 1, height: 48, marginHorizontal: 12 }}>
        <View style={{ position: "absolute", top: 22, left: 0, right: 0, height: 4, backgroundColor: palette.line, borderRadius: 2 }} />
        <View style={{ position: "absolute", top: 22, left: `${(minimum - 1) / 11 * 100}%`, width: `${(maximum - minimum) / 11 * 100}%`, height: 4, backgroundColor: palette.primary }} />
        {(["minimum", "maximum"] as const).map(handle => {
          const value = handle === "minimum" ? minimum : maximum;
          return <View key={handle} accessible accessibilityRole="adjustable" accessibilityLabel={handle === "minimum" ? "Minimum weight" : "Maximum weight"}
            accessibilityState={{ disabled: !!disabled }} accessibilityValue={{ min: handle === "minimum" ? 1 : minimum + 1, max: handle === "maximum" ? 12 : maximum - 1, now: value, text: `${value} kg` }}
            accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
            onAccessibilityAction={event => update(handle, value + (event.nativeEvent.actionName === "increment" ? 1 : -1))}
            onStartShouldSetResponder={() => !disabled} onMoveShouldSetResponder={() => !disabled}
            onResponderGrant={event => { drag.current = { start: event.nativeEvent.pageX, value }; }}
            onResponderMove={event => update(handle, drag.current.value + (event.nativeEvent.pageX - drag.current.start) / width * 11)}
            style={{ position: "absolute", left: `${(value - 1) / 11 * 100}%`, marginLeft: -22, width: 44, height: 48, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.5 : 1 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: palette.primary, borderWidth: 2, borderColor: "white" }} />
          </View>;
        })}
      </View>
      <View style={{ padding: 8, borderRadius: 9, backgroundColor: palette.surface }}><Txt style={{ fontWeight: "700" }}>{maximum} kg</Txt></View>
    </View>
    <Txt style={{ fontSize: 11, color: palette.muted }}>Choose from 1–12 kg in 1 kg steps.</Txt>
  </View>;
}
