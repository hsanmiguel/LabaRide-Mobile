import { useEffect, useState, useSyncExternalStore } from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { RefreshCw } from "lucide-react-native";
import { useFlowNavigation, useOrders, useOwnedShop, type Order, type Service } from "./data";
import { Card, Empty, IconButton, Screen, SearchBox, Txt, money, usePalette } from "./ui";
import { QueryState } from "./UserScreens";
import { shopOrderProgress, shopOrderTiming, shopOrderTransport } from "./shop-orders";
import { operationOrders, operationStage, operationStages, operationTime, pastReadyEstimate } from "./live-operations";
import { serviceCardColors } from "./service-colors";
import { socketService } from "../services/socket.service";
import { ProcessingTimer } from "./ProcessingTimer";

function OperationCard({ order, services, width, now, compact }: { order: Order; services: Service[]; width: number; now: number; compact: boolean }) {
  const palette = usePalette();
  const { go } = useFlowNavigation();
  const timing = shopOrderTiming(order);
  const colors = serviceCardColors(services.find(service => service.serviceName === order.serviceName)?.color);
  const overdue = pastReadyEstimate(order, now);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open live order ${order.id}, ${order.userName}`}
    onPress={() => go("shop-transaction", { id: String(order.id) })}
    style={({ pressed }) => ({ width, opacity: pressed ? 0.8 : 1 })}>
    <Card testID={`live-order-${order.id}`} style={{ padding: compact ? 10 : 12, gap: compact ? 5 : 7, borderWidth: 2, borderColor: colors.background }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Txt style={{ fontSize: 16, fontWeight: "700", color: palette.primary }}>#{order.id}</Txt>
        <Txt style={{ fontSize: 16, fontWeight: "700", color: palette.primary }}>{money(order.totalAmount)}</Txt>
      </View>
      <Txt numberOfLines={1} style={{ fontWeight: "700", fontSize: 15 }}>{order.userName}</Txt>
      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
        <View style={{ maxWidth: "100%", backgroundColor: colors.background, borderRadius: 7, overflow: "hidden" }}>
          <View style={{ backgroundColor: colors.detailBackground, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Txt numberOfLines={2} style={{ fontSize: 12, fontWeight: "700", color: colors.foreground }}>{order.serviceName}</Txt>
          </View>
        </View>
        <Txt style={{ color: palette.muted, fontSize: 12 }}>{Number(order.kiloAmount)} kg</Txt>
      </View>
      <Txt style={{ color: palette.primary, fontWeight: "600", fontSize: 12 }}>{shopOrderProgress(order)}</Txt>
      <ProcessingTimer order={order} compact />
      {!compact && <Txt style={{ fontSize: 11, color: palette.muted }}>{shopOrderTransport(order)}</Txt>}
      {(!compact || overdue) && <View style={{ borderTopWidth: compact ? 0 : 1, borderTopColor: palette.line, paddingTop: compact ? 0 : 8, gap: 2 }}>
        {overdue && <Txt style={{ color: "#9A3412", fontWeight: "700", fontSize: 12 }}>Past ready estimate</Txt>}
        {!compact && <Txt style={{ color: palette.muted, fontSize: 11 }}>{timing.label}: {operationTime(timing.value)} (PHT)</Txt>}
      </View>}
    </Card>
  </Pressable>;
}

export function LiveOperationsDesign() {
  const palette = usePalette();
  const owned = useOwnedShop();
  const orders = useOrders(true);
  const connection = useSyncExternalStore(socketService.subscribeConnection, socketService.getConnectionStatus, socketService.getConnectionStatus);
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState("");
  const [service, setService] = useState("");
  const [compact, setCompact] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const { refetch } = orders;
  useEffect(() => { if (connection === "connected") void refetch(); }, [connection, refetch]);
  const active = operationOrders(orders.data || []);
  const visible = operationOrders(orders.data || [], query, service);
  const services = owned.data?.services || [];
  const options = [...new Set([...services.map(item => item.serviceName), ...active.map(order => order.serviceName)])].sort();
  // A full card plus a visible edge of the next card makes each horizontal rail discoverable on phones.
  const cardWidth = Math.min(272, Math.max(180, width - 112));
  const loading = owned.isLoading || (!!owned.data && orders.isLoading);
  const error = owned.error || orders.error;
  const stale = orders.isError && !!orders.data;
  return <Screen title="Live operations" right={<IconButton label="Refresh live operations" onPress={() => { void owned.refetch(); void orders.refetch(); }}><RefreshCw size={20} color={palette.primary} /></IconButton>}>
    <View style={{ gap: 14 }}>
      <View style={{ gap: 5 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Txt numberOfLines={1} style={{ flex: 1, fontSize: 16, fontWeight: "700" }}>{owned.data?.shopName || "Your laundry workflow"}</Txt>
          <Pressable accessibilityRole="switch" accessibilityLabel="Compact live operations" accessibilityState={{ checked: compact }} onPress={() => setCompact(value => !value)}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 }}>
            <Txt style={{ fontSize: 12, fontWeight: "600", color: palette.primary }}>Compact</Txt>
            <View style={{ width: 36, height: 22, padding: 3, borderRadius: 11, justifyContent: "center", backgroundColor: compact ? palette.primary : palette.muted }}>
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: "white", alignSelf: compact ? "flex-end" : "flex-start" }} />
            </View>
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: stale ? "#9A3412" : connection === "connected" ? "#15803D" : palette.muted }} />
          <Txt accessibilityLiveRegion="polite" style={{ color: palette.muted, fontSize: 12 }}>
            {stale ? "Updates unavailable · showing saved orders" : connection === "connected" ? "Live updates connected" : "Auto-refresh every 15 seconds"}
          </Txt>
        </View>
        {!compact && !!orders.dataUpdatedAt && <Txt style={{ color: palette.muted, fontSize: 11 }}>Last fetched: {operationTime(new Date(orders.dataUpdatedAt).toISOString())} (PHT)</Txt>}
      </View>
      <SearchBox value={query} onChangeText={setQuery} placeholder="Search order, customer or service" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {["", ...options, ...(service && !options.includes(service) ? [service] : [])].map(value => <Pressable key={value || "all"} accessibilityRole="button"
          accessibilityLabel={`Live service: ${value || "All services"}`} accessibilityState={{ selected: service === value }} onPress={() => setService(value)}
          style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 14, borderRadius: 22, backgroundColor: service === value ? palette.primary : "white", borderWidth: 1, borderColor: service === value ? palette.primary : palette.line }}>
          <Txt style={{ color: service === value ? "white" : palette.ink, fontWeight: "600", fontSize: 12 }}>{value || "All services"}</Txt>
        </Pressable>)}
      </ScrollView>
      <QueryState loading={loading} error={error} retry={() => { void owned.refetch(); void orders.refetch(); }} />
      {!loading && !error && !owned.data && <Empty title="Set up your laundry shop" message="Register your shop from Dashboard to manage ongoing orders." />}
      {!loading && owned.data && (!error || stale) && <>
        <View style={{ gap: 2 }}>
          <Txt accessibilityLiveRegion="polite" style={{ fontWeight: "700" }}>{query.trim() || service ? `${visible.length} of ${active.length}` : active.length} active {active.length === 1 ? "order" : "orders"}</Txt>
          <Txt style={{ color: palette.muted, fontSize: 11 }}>Oldest orders first · Swipe rows · Tap to manage</Txt>
        </View>
        {active.length === 0 ? <Card><Empty title="No ongoing orders" message="New bookings will appear here as they move through your laundry workflow." /></Card>
          : visible.length === 0 ? <Card><Empty title="No matching orders" message="Try another customer, order number or service." action="Clear filters" onPress={() => { setQuery(""); setService(""); }} /></Card>
          : <View testID="live-operations-board">{operationStages.map((stage, index) => {
            const stageOrders = visible.filter(order => operationStage(order) === stage.id);
            return <View key={stage.id} testID={`live-stage-${stage.id}`} style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ width: 30, alignItems: "center" }}>
                <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: stageOrders.length ? palette.primary : "white", borderWidth: 2, borderColor: stageOrders.length ? palette.primary : palette.line }}>
                  <Txt style={{ fontWeight: "700", fontSize: 12, color: stageOrders.length ? "white" : palette.muted }}>{index + 1}</Txt>
                </View>
                {index < operationStages.length - 1 && <View style={{ width: 2, flex: 1, minHeight: 24, backgroundColor: palette.line }} />}
              </View>
              <View style={{ flex: 1, minWidth: 0, paddingBottom: compact ? 14 : 22, gap: compact ? 5 : 9 }}>
                <View style={{ flexDirection: "row", alignItems: "center", minHeight: 30, gap: 8 }}>
                  <Txt accessibilityRole="header" style={{ flex: 1, fontWeight: "700", fontSize: 17 }}>{stage.title}</Txt>
                  <View style={{ backgroundColor: palette.soft, borderRadius: 12, minWidth: 26, paddingHorizontal: 7, alignItems: "center" }}><Txt style={{ color: palette.primary, fontWeight: "700", fontSize: 12 }}>{stageOrders.length}</Txt></View>
                </View>
                {!compact && <Txt style={{ color: palette.muted, fontSize: 11 }}>{stage.description}</Txt>}
                {stageOrders.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 2 }}>
                  {stageOrders.map(order => <OperationCard key={order.id} order={order} services={services} width={cardWidth} now={now} compact={compact} />)}
                </ScrollView> : <View style={{ padding: 13, borderRadius: 12, backgroundColor: "white", borderWidth: 1, borderStyle: "dashed", borderColor: palette.line }}><Txt style={{ color: palette.muted, fontSize: 12 }}>{stage.empty}</Txt></View>}
              </View>
            </View>;
          })}</View>}
      </>}
    </View>
  </Screen>;
}
