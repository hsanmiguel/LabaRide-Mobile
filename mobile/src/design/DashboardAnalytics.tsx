import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop, Line, Text as SvgText } from "react-native-svg";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Banknote, ClipboardList, CheckCircle2, WashingMachine } from "lucide-react-native";
import { api } from "./data";
import { Button, Card, Txt, money, usePalette, styles } from "./ui";
import { QueryState } from "./UserScreens";
import PickerField from "./PickerField";
import { chartScale, dashboardToday, displayAnalyticsDate, pointLabel, presetDates, rangeError, type ChartMetric, type DashboardPreset, type ShopAnalytics } from "./dashboard-analytics";

function PerformanceChart({ data }: { data: ShopAnalytics }) {
  const palette = usePalette();
  const [metric, setMetric] = useState<ChartMetric>("Orders");
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => setSelected(null), [data.range.start, data.range.end]);
  const [width, setWidth] = useState(280);
  const points = data.series;
  const values = points.map(point => metric === "Orders" ? point.orders : point.completedValue);
  const scale = chartScale(values, metric);
  const color = metric === "Orders" ? palette.primary : palette.successInk;
  const height = 220, left = 56, right = width - 12, top = 16, bottom = 180;
  const coordinates = values.map((value, index) => ({ x: left + index * (right - left) / Math.max(1, values.length - 1), y: bottom - value / scale.maximum * (bottom - top) }));
  const line = coordinates.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  const total = metric === "Orders" ? data.summary.orders : data.summary.completedValue;
  const formatValue = (value: number) => metric === "Orders" ? `${value} ${value === 1 ? "order" : "orders"}` : money(value);
  const selectedPoint = selected === null ? null : points[selected];
  const shortValue = (value: number) => metric === "Orders" ? String(value) : `₱${value >= 1_000_000 ? `${+(value / 1_000_000).toFixed(1)}m` : value >= 1000 ? `${+(value / 1000).toFixed(1)}k` : value % 1 ? value.toFixed(2) : value}`;
  const tickIndices = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])].filter(index => index >= 0);
  return <Card testID="dashboard-performance" style={{ flex: 1, minWidth: 0 }}>
    <Txt accessibilityRole="header" style={styles.heading}>Performance</Txt>
    <View accessibilityRole="tablist" style={{ flexDirection: "row", padding: 4, borderRadius: 12, backgroundColor: palette.surface }}>
      {(["Orders", "Revenue"] as const).map(value => <Pressable key={value} accessibilityRole="tab" accessibilityLabel={`Show ${value.toLowerCase()} graph`} accessibilityState={{ selected: metric === value }}
        onPress={() => { setMetric(value); setSelected(null); }} style={{ flex: 1, minHeight: 44, justifyContent: "center", alignItems: "center", borderRadius: 9, backgroundColor: metric === value ? "white" : "transparent", borderWidth: 1, borderColor: metric === value ? palette.line : "transparent" }}>
        <Txt style={{ fontWeight: "700", color: metric === value ? palette.primary : palette.muted }}>{value}</Txt>
      </Pressable>)}
    </View>
    <View style={{ gap: 2 }}>
      <Txt testID="dashboard-chart-total" style={{ color, fontWeight: "700", fontSize: 28 }}>{formatValue(total)}</Txt>
      <Txt style={{ color: palette.muted, fontSize: 12 }}>{metric === "Revenue" ? "Based on completed order value · includes delivery" : "Orders received by date placed"}</Txt>
      <Txt style={{ color: palette.muted, fontSize: 11 }}>{({ hour: "Hourly", day: "Daily", week: "Weekly", month: "Monthly" })[data.range.granularity]} totals · Philippine time</Txt>
    </View>
    <View onLayout={event => setWidth(Math.max(160, event.nativeEvent.layout.width))} testID="dashboard-line-chart" style={{ height }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} accessible={false}>
        <Defs><LinearGradient id="performance-fill" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={color} stopOpacity={0.18} /><Stop offset="1" stopColor={color} stopOpacity={0.02} /></LinearGradient></Defs>
        {scale.ticks.map(value => {
          const y = bottom - value / scale.maximum * (bottom - top);
          return <Svg key={value}><Line x1={left} x2={right} y1={y} y2={y} stroke={palette.line} strokeDasharray="4 4" /><SvgText x={left - 8} y={y + 4} textAnchor="end" fontSize={10} fill={palette.muted}>{metric === "Orders" ? value : shortValue(value)}</SvgText></Svg>;
        })}
        {!!coordinates.length && <><Path d={`${line} L${right},${bottom} L${left},${bottom} Z`} fill="url(#performance-fill)" /><Path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" /></>}
        {selected !== null && coordinates[selected] && <><Line x1={coordinates[selected].x} x2={coordinates[selected].x} y1={top} y2={bottom} stroke={color} strokeDasharray="3 3" /><Circle cx={coordinates[selected].x} cy={coordinates[selected].y} r={5} fill={color} stroke="white" strokeWidth={2} /></>}
        {tickIndices.map(index => <SvgText key={index} x={coordinates[index]?.x || left} y={205} textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"} fill={palette.muted} fontSize={10}>
          {data.range.granularity === "hour" ? `${Number(points[index].date.slice(11, 13)) % 12 || 12}${Number(points[index].date.slice(11, 13)) < 12 ? "am" : "pm"}` : displayAnalyticsDate(points[index].date, false)}
        </SvgText>)}
      </Svg>
      <View style={{ position: "absolute", left: left - 7, right: 5, top: 0, bottom: 30, flexDirection: "row" }}>
        {points.map((point, index) => <Pressable key={point.date} accessibilityRole="button" accessibilityLabel={`${pointLabel(point, data.range.granularity)}: ${formatValue(values[index])}`}
          onPress={() => setSelected(index)} style={{ flex: 1 }} />)}
      </View>
    </View>
    <View style={{ backgroundColor: palette.surface, padding: 12, borderRadius: 10, gap: 3, minHeight: 64 }} accessibilityLiveRegion="polite">
      <Txt style={{ color: palette.muted, fontSize: 12 }}>{selectedPoint ? pointLabel(selectedPoint, data.range.granularity) : total === 0 ? "No activity for this metric in the selected period" : "Tap the graph to see an exact value"}</Txt>
      {selected !== null && selectedPoint && <Txt style={{ color, fontWeight: "700" }}>{formatValue(values[selected])}</Txt>}
    </View>
  </Card>;
}

export function DashboardAnalytics({ shopId }: { shopId: number }) {
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const today = dashboardToday();
  const [preset, setPreset] = useState<DashboardPreset>("30 days");
  const [customRange, setCustomRange] = useState(presetDates("30 days", today));
  const range = preset === "Custom" ? customRange : presetDates(preset, today);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(range);
  const [error, setError] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["shop-analytics", shopId, range.start, range.end], enabled: !!shopId,
    queryFn: () => api.get<ShopAnalytics>(`/shops/${shopId}/analytics?start=${range.start}&end=${range.end}`), refetchInterval: 15000 });
  const data = query.data;
  function choose(value: DashboardPreset) {
    if (value === "Custom") { setDraft(range); setError(null); setEditing(true); } else setPreset(value);
  }
  const metrics = data ? [
    { label: "Completed order value", value: money(data.summary.completedValue), Icon: Banknote },
    { label: "Orders received", value: String(data.summary.orders), Icon: ClipboardList },
    { label: "Completed orders", value: String(data.summary.completedOrders), Icon: CheckCircle2 },
    { label: "Laundry processed", value: `${Number(data.summary.kilos.toFixed(2))} kg`, Icon: WashingMachine },
  ] : [];
  return <View style={{ gap: 20 }}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {(["Today", "7 days", "30 days", "Custom"] as DashboardPreset[]).map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Dashboard ${value}`} accessibilityState={{ selected: preset === value }} onPress={() => choose(value)}
        style={{ minHeight: 44, paddingHorizontal: 18, borderWidth: 1, borderColor: preset === value ? palette.primary : palette.line, backgroundColor: preset === value ? palette.primary : "white", borderRadius: 22, justifyContent: "center" }}>
        <Txt style={{ color: preset === value ? "white" : palette.muted, fontWeight: "600", fontSize: 13 }}>{value}</Txt>
      </Pressable>)}
    </ScrollView>
    <Txt style={{ color: palette.muted, fontSize: 12 }}>{displayAnalyticsDate(range.start)}{range.start !== range.end ? ` – ${displayAnalyticsDate(range.end)}` : ""} · PHT</Txt>
    <QueryState loading={query.isLoading} error={query.error} retry={() => query.refetch()} />
    {data && !query.error && <>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>{metrics.map(({ label, value, Icon }) => <Card key={label} style={{ flexBasis: width >= 1100 ? "22%" : "44%", flexGrow: 1, minWidth: 0, padding: 16 }}>
        <Icon size={20} color={palette.primary} /><Txt style={{ color: palette.muted, fontSize: 12 }}>{label}</Txt><Txt style={{ fontWeight: "700", fontSize: 25, color: palette.primary }}>{value}</Txt>
      </Card>)}</View>
      {!!data.undatedCompletedOrders && <Txt style={{ color: palette.muted, fontSize: 12 }}>{data.undatedCompletedOrders} older completed {data.undatedCompletedOrders === 1 ? "order has" : "orders have"} no recorded completion date and {data.undatedCompletedOrders === 1 ? "is" : "are"} excluded from completion-based metrics.</Txt>}
      <View style={{ flexDirection: width >= 1100 ? "row" : "column", alignItems: "stretch", gap: 16 }}>
        <PerformanceChart data={data} />
        <Card style={{ width: width >= 1100 ? 310 : undefined, gap: 16 }} testID="dashboard-popular-services">
          <View><Txt accessibilityRole="header" style={styles.heading}>Popular services</Txt><Txt style={{ color: palette.muted, fontSize: 12 }}>By orders completed in this period</Txt></View>
          {data.popularServices.length ? data.popularServices.map(service => <View key={service.name} style={{ gap: 7 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}><Txt style={{ flex: 1, fontWeight: "600" }}>{service.name}</Txt><Txt style={{ color: palette.primary, fontWeight: "700" }}>{service.orders}</Txt></View>
            <View style={{ height: 7, borderRadius: 4, backgroundColor: palette.soft, overflow: "hidden" }}><View style={{ height: "100%", width: `${service.orders / Math.max(1, data.popularServices[0].orders) * 100}%`, backgroundColor: palette.primary, borderRadius: 4 }} /></View>
            <Txt style={{ fontSize: 11, color: palette.muted }}>{Number(service.kilos.toFixed(2))} kg · {money(service.value)}</Txt>
          </View>) : <Txt style={{ color: palette.muted }}>No completed services in this period.</Txt>}
        </Card>
      </View>
      <View style={{ gap: 12 }}><View><Txt accessibilityRole="header" style={styles.heading}>Needs attention</Txt><Txt style={{ color: palette.muted, fontSize: 12 }}>Current workload · independent of date filters</Txt></View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{(["Pending", "Queued", "Ready"] as const).map(status => <Button key={status} title={`${data.workload[status.toLowerCase() as keyof typeof data.workload]} ${status}`} outline compact
          onPress={() => router.push({ pathname: "/shop/transactions", params: { status } })} />)}</View>
      </View>
    </>}
    <Modal transparent visible={editing} animationType="none" onRequestClose={() => setEditing(false)}>
      <View style={{ flex: 1, backgroundColor: "#00000066", padding: 20, alignItems: "center", justifyContent: "center" }}>
        <Card style={{ width: "100%", maxWidth: 440 }}><ScrollView keyboardShouldPersistTaps="handled">
          <Txt style={[styles.heading, { marginBottom: 16 }]}>Choose date range</Txt>
          <PickerField label="Analytics start date" mode="date" value={draft.start} maximumDate={new Date(today + "T23:59:59")} onChange={value => { setDraft(current => ({ ...current, start: value })); setError(null); }} />
          <PickerField label="Analytics end date" mode="date" value={draft.end} maximumDate={new Date(today + "T23:59:59")} onChange={value => { setDraft(current => ({ ...current, end: value })); setError(null); }} />
          <Txt style={{ color: palette.muted, fontSize: 12, marginBottom: 16 }}>Up to 366 days, using Philippine time.</Txt>
          {!!error && <Txt accessibilityRole="alert" style={{ color: palette.danger, marginBottom: 12 }}>{error}</Txt>}
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12 }}><Button title="Cancel" outline onPress={() => setEditing(false)} /><Button title="Apply dates" onPress={() => {
            const invalid = rangeError(draft.start, draft.end, today);
            if (invalid) return setError(invalid);
            setCustomRange(draft); setPreset("Custom"); setEditing(false);
          }} /></View>
        </ScrollView></Card>
      </View>
    </Modal>
  </View>;
}
