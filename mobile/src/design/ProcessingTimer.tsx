import { useEffect, useState } from "react";
import { AppState, View } from "react-native";
import { Timer } from "lucide-react-native";
import { Txt, usePalette } from "./ui";
import { processingIsActive, processingTimers, timerPhaseText, type ProcessingTimingOrder } from "./processing-timer";

export function ProcessingTimer({ order, compact = false }: { order: ProcessingTimingOrder; compact?: boolean }) {
  const palette = usePalette();
  const [now, setNow] = useState(Date.now());
  const active = processingIsActive(order);
  useEffect(() => {
    if (!active) return;
    const update = () => setNow(Date.now());
    update();
    const interval = setInterval(update, 1000);
    const subscription = AppState.addEventListener("change", state => { if (state === "active") update(); });
    return () => { clearInterval(interval); subscription.remove(); };
  }, [active, order.processingStartedAt, order.dryingStartedAt]);
  const timers = processingTimers(order, now);
  if (!timers) return null;
  return <View testID="processing-timer" style={{ gap: compact ? 5 : 8, backgroundColor: palette.soft, borderRadius: 10, padding: compact ? 8 : 12 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <Timer size={14} color={palette.primary} />
      <Txt style={{ fontSize: 11, color: palette.primary, fontWeight: "700" }}>{timers.estimatedSequence ? "Wash & dry estimate" : "Wash & dry timers"}</Txt>
    </View>
    {timers.phases.map(phase => <View key={phase.name} style={{ gap: 3 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, flexWrap: "wrap" }}>
        <Txt style={{ fontSize: 12, fontWeight: "600" }}>{phase.name}</Txt>
        <Txt style={{ fontSize: 12, fontWeight: "600", fontVariant: ["tabular-nums"], color: phase.state === "elapsed" ? "#9A3412" : phase.state === "running" ? palette.primary : palette.muted }}>{timerPhaseText(phase)}</Txt>
      </View>
      <View style={{ height: 3, borderRadius: 2, overflow: "hidden", backgroundColor: palette.line }}>
        <View style={{ height: 3, width: `${phase.progress * 100}%`, backgroundColor: phase.state === "elapsed" ? "#9A3412" : palette.primary }} />
      </View>
    </View>)}
    {!compact && <Txt style={{ fontSize: 11, color: palette.muted }}>Estimates only. The shop confirms each step.{order.processingTimingSource === "current-service" ? " Uses current service times for this earlier order." : ""}</Txt>}
  </View>;
}
