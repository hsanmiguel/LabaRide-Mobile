import { Pressable, View } from "react-native";
import { Check } from "lucide-react-native";
import { Txt, usePalette } from "./ui";
import { orderDetailSteps } from "./order-detail-steps";

export function OrderStepIndicator({ current, selected, complete, cancelled, onSelect }: {
  current: number; selected: number; complete: boolean; cancelled: boolean; onSelect: (step: number) => void;
}) {
  const palette = usePalette();
  return <View testID="order-step-indicator" accessibilityRole="tablist" style={{ flexDirection: "row" }}>
    {orderDetailSteps.map((step, index) => {
      const done = index < current || complete;
      const accent = index === current && cancelled ? palette.danger : palette.primary;
      return <Pressable key={step.title} accessibilityRole="tab" accessibilityLabel={`Order step ${index + 1}: ${step.title}`}
        accessibilityState={{ selected: index === selected }} onPress={() => onSelect(index)}
        style={{ flex: 1, minWidth: 0, minHeight: 70, paddingVertical: 6, gap: 6, borderRadius: 10, backgroundColor: index === selected ? palette.soft : "transparent" }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1, height: 2, backgroundColor: index === 0 ? "transparent" : index <= current ? palette.primary : palette.line }} />
          <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: index <= current ? accent : palette.line,
            backgroundColor: done ? palette.primary : "white", alignItems: "center", justifyContent: "center" }}>
            {done ? <Check size={14} color="white" /> : <Txt style={{ fontSize: 11, fontWeight: "700", color: index === current ? accent : palette.muted }}>{index + 1}</Txt>}
          </View>
          <View style={{ flex: 1, height: 2, backgroundColor: index === orderDetailSteps.length - 1 ? "transparent" : index < current ? palette.primary : palette.line }} />
        </View>
        <Txt numberOfLines={2} style={{ textAlign: "center", fontSize: 10, lineHeight: 14, fontWeight: index === selected ? "700" : "500", color: index <= current || index === selected ? palette.primary : palette.muted }}>{step.title}</Txt>
      </Pressable>;
    })}
  </View>;
}
