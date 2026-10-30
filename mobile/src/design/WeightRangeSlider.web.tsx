import { useId } from "react";
import { View } from "react-native";
import type { WeightRangeProps } from "./WeightRangeSlider";
import { Txt, usePalette } from "./ui";

export default function WeightRangeSlider({ minimum, maximum, disabled, onChange }: WeightRangeProps) {
  const palette = usePalette();
  const id = useId();
  const thumbStyle = `.weight-range-input{appearance:none;-webkit-appearance:none;position:absolute;left:0;top:0;width:100%;height:48px;margin:0;background:transparent;pointer-events:none;outline:none}.weight-range-input::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;width:22px;height:22px;border:2px solid white;border-radius:50%;background:${palette.primary};pointer-events:auto;cursor:grab;box-shadow:0 1px 4px #0002}.weight-range-input::-moz-range-thumb{width:18px;height:18px;border:2px solid white;border-radius:50%;background:${palette.primary};pointer-events:auto;cursor:grab}.weight-range-input:focus-visible::-webkit-slider-thumb{outline:3px solid ${palette.accent};outline-offset:3px}.weight-range-input:focus-visible::-moz-range-thumb{outline:3px solid ${palette.accent};outline-offset:3px}`;
  return <View style={{ gap: 8 }}>
    <style>{thumbStyle}</style>
    <Txt nativeID={id} style={{ fontSize: 12, fontWeight: "500" }}>Weight range (kg)</Txt>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ padding: 8, borderRadius: 9, backgroundColor: palette.surface }}><Txt style={{ fontWeight: "700" }}>{minimum} kg</Txt></View>
      <div style={{ flex: 1, minWidth: 0, height: 48, position: "relative", opacity: disabled ? 0.5 : 1 }}>
        <div style={{ position: "absolute", top: 22, left: 11, right: 11, height: 4, borderRadius: 2, background: palette.line }}>
          <div style={{ position: "absolute", left: `${(minimum - 1) / 11 * 100}%`, width: `${(maximum - minimum) / 11 * 100}%`, height: 4, background: palette.primary }} />
        </div>
        <input className="weight-range-input" type="range" min={1} max={12} step={1} value={minimum} disabled={disabled}
          aria-label="Minimum weight" aria-valuemin={1} aria-valuemax={maximum - 1} aria-valuenow={minimum} aria-valuetext={`${minimum} kg`}
          onChange={event => onChange(Math.min(Number(event.currentTarget.value), maximum - 1), maximum)} />
        <input className="weight-range-input" type="range" min={1} max={12} step={1} value={maximum} disabled={disabled}
          aria-label="Maximum weight" aria-valuemin={minimum + 1} aria-valuemax={12} aria-valuenow={maximum} aria-valuetext={`${maximum} kg`}
          onChange={event => onChange(minimum, Math.max(Number(event.currentTarget.value), minimum + 1))} />
      </div>
      <View style={{ padding: 8, borderRadius: 9, backgroundColor: palette.surface }}><Txt style={{ fontWeight: "700" }}>{maximum} kg</Txt></View>
    </View>
    <Txt style={{ fontSize: 11, color: palette.muted }}>Choose from 1–12 kg in 1 kg steps.</Txt>
  </View>;
}
