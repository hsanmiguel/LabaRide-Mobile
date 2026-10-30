import { useEffect, useState } from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Bell, CheckCircle2, ChevronRight, Clock, WashingMachine } from "lucide-react-native";
import { useOrders, type Order } from "./data";
import { Button, Card, Empty, IconButton, Screen, SearchBox, Txt, money, usePalette } from "./ui";
import { StatusBadge } from "./OrderScreens";
import { QueryState } from "./UserScreens";
import { ORDERS_PER_PAGE, PageControls } from "./Pagination";
import { activeStatuses, pastStatuses, matchesOrderFilter, orderIsPast, shopOrderStatus, shopOrderProgress, shopOrderTiming, shopOrderTransport, visibleShopOrders, type OrderSection, type ShopOrderFilter } from "./shop-orders";

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function openOrder(order: Order) {
  router.push({ pathname: "/shop/transactions/[flow]", params: { flow: "shop-transaction", id: String(order.id) } });
}

function OrderInfo({ order }: { order: Order }) {
  const palette = usePalette();
  return <View style={{ gap: 3 }}>
    <Txt style={{ color: palette.primary, fontSize: 12, fontWeight: "600" }}>{shopOrderProgress(order)}</Txt>
    {shopOrderStatus(order) === "Cancelled" && !order.workflowStatus && !!order.notes &&
      <Txt numberOfLines={2} style={{ color: palette.muted, fontSize: 12 }}>Reason: {order.notes}</Txt>}
  </View>;
}

function OrderList({ orders }: { orders: Order[] }) {
  const palette = usePalette();
  const { width } = useWindowDimensions();
  if (width < 1024) return <View style={{ gap: 14 }}>{orders.map(order => {
    const timing = shopOrderTiming(order);
    return <Pressable key={order.id} accessibilityRole="button" accessibilityLabel={`View order ${order.id}, ${order.userName}`} onPress={() => openOrder(order)}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
      <Card style={{ padding: 18, gap: 12 }} testID={`shop-order-${order.id}`}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Txt style={{ color: palette.muted, fontSize: 12, fontWeight: "600" }}>Order #{order.id}</Txt>
          <StatusBadge status={shopOrderStatus(order)} />
        </View>
        <View style={{ gap: 3 }}>
          <Txt style={{ fontWeight: "700", fontSize: 18 }}>{order.userName}</Txt>
          <Txt style={{ color: palette.muted }}>{order.serviceName} · {Number(order.kiloAmount)} kg</Txt>
        </View>
        <OrderInfo order={order} />
        <View style={{ gap: 4 }}>
          <Txt style={{ color: palette.muted, fontSize: 12 }}>{shopOrderTransport(order)}</Txt>
          <Txt style={{ color: palette.muted, fontSize: 12 }}>{timing.label}: {formatTime(timing.value)} (PHT)</Txt>
        </View>
        <View style={{ borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <View><Txt style={{ color: palette.muted, fontSize: 11 }}>Order total</Txt><Txt style={{ color: palette.primary, fontWeight: "700", fontSize: 24 }}>{money(order.totalAmount)}</Txt></View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Txt style={{ color: palette.primary, fontWeight: "600", fontSize: 12 }}>View order</Txt><ChevronRight size={18} color={palette.primary} /></View>
        </View>
      </Card>
    </Pressable>;
  })}</View>;
  const columns = [80, 170, 190, 200, 200, 130, 105];
  return <Card style={{ padding: 0, overflow: "hidden" }}><ScrollView horizontal>
    <View style={{ paddingHorizontal: 18 }}>
      <View style={{ flexDirection: "row", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: palette.line }}>
        {["Order", "Customer", "Service / weight", "Status / progress", "Schedule (PHT)", "Total", "Action"].map((label, index) =>
          <Txt key={label} style={{ width: columns[index], fontWeight: "600", fontSize: 12, color: palette.muted }}>{label}</Txt>)}
      </View>
      {orders.map(order => {
        const timing = shopOrderTiming(order);
        return <Pressable key={order.id} testID={`shop-order-${order.id}`} accessibilityRole="button" accessibilityLabel={`View order ${order.id}, ${order.userName}`} onPress={() => openOrder(order)}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: palette.line, backgroundColor: pressed ? palette.soft : "white" })}>
          <Txt style={{ width: columns[0], fontWeight: "700" }}>#{order.id}</Txt>
          <Txt style={{ width: columns[1], paddingRight: 16, fontWeight: "700" }}>{order.userName}</Txt>
          <View style={{ width: columns[2], paddingRight: 16, gap: 4 }}><Txt style={{ fontWeight: "600" }}>{order.serviceName} · {Number(order.kiloAmount)} kg</Txt><Txt style={{ color: palette.muted, fontSize: 11 }}>{shopOrderTransport(order)}</Txt></View>
          <View style={{ width: columns[3], paddingRight: 16, gap: 8, alignItems: "flex-start" }}><StatusBadge status={shopOrderStatus(order)} /><OrderInfo order={order} /></View>
          <View style={{ width: columns[4], paddingRight: 16 }}><Txt style={{ color: palette.muted, fontSize: 11 }}>{timing.label}</Txt><Txt style={{ fontSize: 12 }}>{formatTime(timing.value)}</Txt></View>
          <Txt style={{ width: columns[5], color: palette.primary, fontSize: 18, fontWeight: "700" }}>{money(order.totalAmount)}</Txt>
          <View style={{ width: columns[6], flexDirection: "row", alignItems: "center" }}><Txt style={{ color: palette.primary, fontWeight: "600", fontSize: 12 }}>View order</Txt><ChevronRight size={16} color={palette.primary} /></View>
        </Pressable>;
      })}
    </View>
  </ScrollView></Card>;
}

export function ShopOrdersDesign() {
  const palette = usePalette();
  const orders = useOrders(true);
  const params = useLocalSearchParams<{ status?: string }>();
  const initialFilter = [...activeStatuses, ...pastStatuses].find(status => status === params.status) || "All";
  const [section, setSection] = useState<OrderSection>(pastStatuses.includes(initialFilter as Order["status"]) ? "Past" : "Active");
  const [filter, setFilter] = useState<ShopOrderFilter>(initialFilter);
  const [query, setQuery] = useState("");
  const [oldestFirst, setOldestFirst] = useState(false);
  const [requestedPage, setPage] = useState(0);
  useEffect(() => {
    setFilter(initialFilter);
    setSection(pastStatuses.includes(initialFilter as Order["status"]) ? "Past" : "Active");
    setPage(0);
  }, [initialFilter]);
  const all = orders.data || [];
  const active = all.filter(order => !orderIsPast(order));
  const sectionOrders = section === "Active" ? active : all.filter(orderIsPast);
  const filtered = visibleShopOrders(all, section, filter, query, oldestFirst);
  const page = Math.min(requestedPage, Math.max(0, Math.ceil(filtered.length / ORDERS_PER_PAGE) - 1));
  const shown = filtered.slice(page * ORDERS_PER_PAGE, (page + 1) * ORDERS_PER_PAGE);
  const summaries = [{ title: "Pending", filter: "Pending" as const, Icon: Clock }, { title: "In progress", filter: "In progress" as const, Icon: WashingMachine }, { title: "Ready", filter: "Ready" as const, Icon: CheckCircle2 }];
  function changeSection(value: OrderSection) { setSection(value); setFilter("All"); setPage(0); }
  function changeFilter(value: ShopOrderFilter) { setFilter(value); setPage(0); }
  return <Screen title="Orders" back={false} background={palette.surface}
    right={<IconButton label="Notifications" onPress={() => router.push({ pathname: "/shop/transactions/[flow]", params: { flow: "shop-notifications" } })}><Bell size={22} color={palette.primary} /></IconButton>}>
    <View style={{ gap: 20 }}>
      <View><Txt style={{ fontSize: 22, fontWeight: "700" }}>Your laundry orders</Txt><Txt style={{ color: palette.muted }}>Manage customer orders, laundry progress and handovers.</Txt></View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>{summaries.map(({ title, filter: value, Icon }) => {
        const selected = section === "Active" && filter === value;
        return <Pressable key={title} accessibilityRole="button" accessibilityLabel={`Show ${title.toLowerCase()} orders`} accessibilityState={{ selected }}
          onPress={() => { setSection("Active"); changeFilter(value); }} style={{ flexGrow: 1, flexBasis: 80 }}>
          <Card style={{ padding: 14, minHeight: 110, gap: 8, borderColor: selected ? palette.primary : palette.line, backgroundColor: selected ? palette.soft : "white" }}>
            <Icon size={20} color={palette.primary} />
            <Txt style={{ fontWeight: "700", fontSize: 28, color: palette.primary }}>{orders.isLoading || orders.isError ? "—" : active.filter(order => matchesOrderFilter(order, value)).length}</Txt>
            <Txt style={{ fontSize: 12, fontWeight: "600" }}>{title}</Txt>
          </Card>
        </Pressable>;
      })}</View>
      <SearchBox value={query} onChangeText={value => { setQuery(value); setPage(0); }} placeholder="Search customer, order ID or service" />
      <View accessibilityRole="tablist" style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: palette.line }}>
        {(["Active", "Past"] as const).map(value => <Pressable key={value} accessibilityRole="tab" accessibilityLabel={`${value} Orders`} accessibilityState={{ selected: section === value }}
          onPress={() => changeSection(value)} style={{ flex: 1, minHeight: 52, justifyContent: "center", alignItems: "center", borderBottomWidth: 3, borderBottomColor: section === value ? palette.primary : "transparent" }}>
          <Txt style={{ color: section === value ? palette.primary : palette.muted, fontWeight: "700" }}>{value} Orders ({value === "Active" ? active.length : all.length - active.length})</Txt>
        </Pressable>)}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {(["All", ...(section === "Active" ? activeStatuses : pastStatuses), ...(section === "Active" && filter === "In progress" ? ["In progress"] : [])] as ShopOrderFilter[]).map(value =>
          <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Filter ${value}`} accessibilityState={{ selected: filter === value }} onPress={() => changeFilter(value)}
            style={{ borderRadius: 22, minHeight: 44, justifyContent: "center", paddingHorizontal: 14, borderWidth: 1, borderColor: filter === value ? palette.primary : palette.line, backgroundColor: filter === value ? palette.primary : "white" }}>
            <Txt style={{ color: filter === value ? "white" : palette.muted, fontSize: 12, fontWeight: "600" }}>{value} ({sectionOrders.filter(order => matchesOrderFilter(order, value)).length})</Txt>
          </Pressable>)}
      </ScrollView>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <Txt accessibilityLiveRegion="polite" style={{ color: palette.muted }}>{filtered.length} {section.toLowerCase()} {filtered.length === 1 ? "order" : "orders"}</Txt>
        <Button title={oldestFirst ? "Oldest first" : "Newest first"} outline compact onPress={() => { setOldestFirst(!oldestFirst); setPage(0); }} />
      </View>
      <QueryState loading={orders.isLoading} error={orders.error} retry={() => orders.refetch()} />
      {!orders.isLoading && !orders.error && (filtered.length ? <>
        <OrderList orders={shown} />
        <PageControls page={page} total={filtered.length} onChange={setPage} />
      </> : <Card><Empty title={query.trim() || filter !== "All" ? "No matching orders" : `No ${section.toLowerCase()} orders`}
        message={query.trim() || filter !== "All" ? "Try another search or status filter." : `Your ${section.toLowerCase()} customer orders will appear here.`}
        {...(query.trim() || filter !== "All" ? { action: "Clear filters", onPress: () => { setQuery(""); changeFilter("All"); } } : {})} /></Card>)}
    </View>
  </Screen>;
}
