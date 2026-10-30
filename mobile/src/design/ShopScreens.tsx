import { ORDERS_PER_PAGE, PageControls } from "./Pagination";
import { useEffect, useState, useRef } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Bell,
  WashingMachine,
  Clock,
  CheckSquare,
  Square,
  ChevronRight,
  MapPin,
  Pencil,
  Plus,
  Store,
  UserRound,
  Trash2,
  Check,
  X,
} from "lucide-react-native";
import { router, Redirect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";
import {
  Asset,
  IconButton,
  Brand,
  Button,
  Card,
  Choice,
  Empty,
  Field,
  MenuRow,
  PriceRow,
  Screen,
  Section,
  Txt,
  money,
  usePalette,
  styles,
} from "./ui";
import {
  address,
  api,
  confirmAction,
  fail,
  useFlowNavigation,
  unavailable,
  useOrders,
  useOwnedShop,
  useShop,
  type KiloPrice,
  type Order,
  type Profile,
  type Service,
} from "./data";
import { OriginalOrderDetails } from "./OriginalOrderDetails";
import { deliveryDay } from "./delivery-slots";
import { StatusBadge } from "./OrderScreens";
import { shopOrderStatus } from "./shop-orders";
import { QueryState } from "./UserScreens";
import { distanceFields, distanceSettingsError } from "./service-area";
import LaundryMap from "./LaundryMap";
import { AddressFields, DeliveryDetails, FormError } from "./AddressFields";
import { addressError, addressPayload, addressValues } from "./address";
import { message, type Shop } from "./data";
import PickerField from "./PickerField";
import { timeInputValue } from "./form-values";
import { ShopPhotoEditor } from "./ShopPhotoEditor";
import { ShopRequirementsPanel } from './ShopRequirements';
import { ShopPhoto } from "./ShopPhoto";
import { ShopApplicationStatus } from "./ShopApprovalScreens";
import { useLogout } from "./useLogout";
import { DeliveryOrderDesign } from './DeliveryScreens';
import { DashboardAnalytics } from './DashboardAnalytics';
import { LiveOperationsButton } from './LiveOperationsButton';
import { normalizeServiceColor, serviceCardColors, serviceColorOptions, serviceColorTaken } from './service-colors';
import WeightRangeSlider from './WeightRangeSlider';

export function RegisterShopDesign() {
  const [values, setValues] = useState<Record<string, string>>({
    shopName: "", contactNumber: "", openingTime: "", closingTime: "", ...addressValues(null, "Work"),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const auth = useAuthStore();
  const owned = useOwnedShop();
  const cache = useQueryClient();
  const applicationPalette = usePalette();
  const { width: applicationWidth } = useWindowDimensions();
  const [editingRejected, setEditingRejected] = useState(false);
  function editRejected() {
    if (!owned.data) return;
    setValues({ ...addressValues(owned.data, "Work"), shopName: owned.data.shopName,
      contactNumber: owned.data.contactNumber || "", openingTime: owned.data.openingTime || "", closingTime: owned.data.closingTime || "" });
    setEditingRejected(true);
  }
  async function openExistingShop() {
    setBusy(true); setError(null);
    try {
      const result = await api.post<{ user: Profile; token: string }>("/auth/verify-token", {});
      if (!result.user.isShopOwner) { setError("No registered shop was found for this account."); return; }
      await auth.setAuth(result.user, result.token);
      await cache.invalidateQueries({ queryKey: ["shop"] });
      await cache.invalidateQueries({ queryKey: ["user"] });
      router.replace("/shop/home");
    } catch (failure) { setError(message(failure)); }
    finally { setBusy(false); }
  }
  async function submit() {
    if (busy) return;
    const missing = ["shopName", "contactNumber", "openingTime", "closingTime"].find(key => !values[key]?.trim());
    const validation = missing ? "Please enter the shop name, contact number, and business hours." :
      values.shopName.trim().length < 2 ? "Shop name must have at least 2 characters." :
        !timeInputValue(values.openingTime) || !timeInputValue(values.closingTime) ? "Choose valid opening and closing times." : addressError(values);
    if (validation) { setError(validation); return; }
    if (!auth.user) return router.replace("/(auth)/login");
    setBusy(true); setError(null);
    try {
      const payload = {
        shopName: values.shopName.trim(), contactNumber: values.contactNumber.trim(),
        openingTime: values.openingTime.trim(), closingTime: values.closingTime.trim(), ...addressPayload(values),
      };
      if (editingRejected && owned.data) {
        const shop = await api.put<Shop>(`/shops/${owned.data.id}/application`, payload);
        cache.setQueryData(["shop", "owner", auth.user.id], shop);
        setEditingRejected(false);
      } else {
        const result = await api.post<Shop & { user: Profile; token: string }>("/shops", payload);
        await auth.setAuth(result.user, result.token);
        cache.setQueryData(["user", result.user.id], result.user);
        const { user, token, ...shop } = result;
        cache.setQueryData(["shop", "owner", user.id], shop);
      }
      void cache.invalidateQueries({ queryKey: ["shops"] });
    } catch (failure) {
      setError(message(failure));
      void owned.refetch();
    } finally { setBusy(false); }
  }
  if (!auth.user) return <Redirect href="/(auth)/login" />;
  return <Screen>
    <View style={{ width: "100%", maxWidth: 1040, alignSelf: "center", paddingTop: 8, gap: 24 }}>
      <View style={[styles.between, { marginBottom: 4 }]}>
        <Brand />
        <Pressable accessibilityRole="button" accessibilityLabel="Back to Profile" onPress={() => router.replace("/(user)/profile")}
          style={({ pressed }) => ({ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, opacity: pressed ? 0.6 : 1 })}>
          <UserRound size={17} color={applicationPalette.muted} /><Txt style={{ fontSize: 12, color: applicationPalette.muted }}>My account</Txt>
        </Pressable>
      </View>
      <View style={{ gap: 6 }}>
        <Txt accessibilityRole="header" style={{ fontSize: applicationWidth < 480 ? 27 : 32, lineHeight: 42, fontWeight: "700", color: applicationPalette.ink }}>Shop application</Txt>
        <Txt style={{ color: applicationPalette.muted, lineHeight: 22 }}>{owned.data && !editingRejected ? "Track your progress on the way to opening your shop." : "Bring your laundry business to LabaRide."}</Txt>
      </View>
      <QueryState loading={owned.isLoading} error={owned.error} retry={() => owned.refetch()} />
      {owned.data && !editingRejected ? <>
        <ShopApplicationStatus shop={owned.data} onRefresh={() => { void owned.refetch(); }} onEdit={editRejected}
          onContinue={() => router.replace("/(user)/profile")} onOpen={openExistingShop} busy={busy}
          refreshing={owned.isFetching} lastCheckedAt={owned.dataUpdatedAt} />
        <FormError error={error} />
        <ShopRequirementsPanel shopId={owned.data.id} />
      </> : !owned.isLoading && !owned.error && <>
        <Txt style={[styles.muted, { marginBottom: 20 }]}>Save your shop details, then upload DTI or SEC registration, TIN proof, and a Mayor’s Permit. An admin must verify your documents and approve the shop before it goes live.</Txt>
        <Section title="Shop Information" />
        {[["shopName", "Shop Name *"], ["contactNumber", "Contact Number *"]].map(([key, label]) =>
          <Field key={key} label={label} value={values[key]} onChangeText={value => setValues(current => ({ ...current, [key]: value }))} />)}
        <Section title="Shop Address" />
        <AddressFields values={values} setValues={setValues} />
        <Section title="Business Hours" />
        <View style={styles.row}>
          {[["openingTime", "Opening Time *", "08:00"], ["closingTime", "Closing Time *", "18:00"]].map(([key, label, initialValue]) =>
            <View key={key} style={styles.grow}><PickerField label={label} mode="time" value={values[key]} initialValue={initialValue}
              onChange={value => setValues(current => ({ ...current, [key]: value }))} /></View>)}
        </View>
        <FormError error={error} />
        <Button title={editingRejected ? "Resubmit for Approval" : "Submit for Approval"} busy={busy} onPress={submit} style={{ marginVertical: 24 }} />
        {editingRejected && <Button title="Cancel" outline onPress={() => setEditingRejected(false)} />}
      </>}
    </View>
  </Screen>;
}
export function TransactionsTable(props: Parameters<typeof TransactionRows>[0]) {
  const [requestedPage, setPage] = useState(0);
  const page = Math.min(requestedPage, Math.max(0, Math.ceil(props.orders.length / ORDERS_PER_PAGE) - 1));
  useEffect(() => { setPage(page); }, [page]);
  return <View>
    <TransactionRows {...props} orders={props.orders.slice(page * ORDERS_PER_PAGE, (page + 1) * ORDERS_PER_PAGE)} />
    {!props.dashboard && <PageControls page={page} total={props.orders.length} onChange={setPage} />}
  </View>;
}

function TransactionRows({
  orders,
  selectable = false,
  selection = [],
  onSelect,
  dashboard = false,
}: {
  orders: Order[];
  selectable?: boolean;
  selection?: number[];
  onSelect?: (id: number) => void;
  dashboard?: boolean;
}) {
  const palette = usePalette();
  const { go } = useFlowNavigation();
  const { width } = useWindowDimensions();
  if (width < 768) return <View style={styles.stack}>
    {orders.map(order => <Pressable key={order.id} accessibilityRole={selectable ? "checkbox" : "button"}
      accessibilityLabel={"Order " + order.id + ", " + order.userName} accessibilityState={selectable ? { checked: selection.includes(order.id) } : undefined}
      onPress={() => selectable ? onSelect?.(order.id) : go("shop-transaction", { id: String(order.id) })}>
      <Card style={{ backgroundColor: selection.includes(order.id) ? palette.soft : "white" }}>
        <View style={styles.between}><Txt style={{ fontWeight: "700" }}>#{order.id} · {order.userName}</Txt><StatusBadge status={order.status} /></View>
        <Txt style={styles.muted}>{order.serviceName}</Txt>
        <Txt style={styles.muted}>{new Date(order.createdAt).toLocaleDateString()} · {order.deliveryType}</Txt>
        <View style={styles.between}><Txt style={{ fontWeight: "700", color: palette.primary }}>{money(order.totalAmount)}</Txt>
          {selectable ? selection.includes(order.id) ? <CheckSquare color={palette.primary} size={22} /> : <Square color={palette.muted} size={22} /> : <ChevronRight color={palette.primary} size={22} />}</View>
      </Card>
    </Pressable>)}
    {!orders.length && <Empty title="No transactions found" message="Orders matching your filters will appear here." />}
  </View>;
  const columns = dashboard
    ? ["Customer Name", "Date", "Service", "Delivery Type", "Status", "Total"]
    : [
      "Customer ID",
      "Recipient Name",
      "Date",
      "Service",
      "Delivery Type",
      "Status",
      "Payment Type",
      "Total Amount",
    ];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View>
        <View
          style={[
            styles.row,
            {
              gap: 0,
              borderBottomWidth: 1,
              borderBottomColor: palette.line,
              paddingVertical: 16,
            },
          ]}
        >
          {selectable && <View style={{ width: 36 }} />}
          {columns.map((column) => (
            <Txt
              key={column}
              style={{ width: 132, fontWeight: "600", fontSize: 12 }}
            >
              {column}
            </Txt>
          ))}
        </View>
        {orders.map((order) => (
          <Pressable accessibilityRole="button"
            key={order.id}
            onPress={() =>
              selectable
                ? onSelect?.(order.id)
                : go("shop-transaction", { id: String(order.id) })
            }
            style={[
              styles.row,
              {
                gap: 0,
                paddingVertical: 18,
                borderBottomWidth: 1,
                borderBottomColor: palette.line,
                backgroundColor: selection.includes(order.id)
                  ? palette.lavender
                  : "white",
              },
            ]}
          >
            {selectable && (
              <Txt style={{ width: 36, color: palette.navy }}>
                {selection.includes(order.id) ? "☑" : "☐"}
              </Txt>
            )}
            {(dashboard
              ? [
                order.userName,
                new Date(order.createdAt).toLocaleDateString(),
                order.serviceName,
                order.deliveryType,
                order.status,
                money(order.totalAmount),
              ]
              : [
                String(order.userId),
                order.userName,
                new Date(order.createdAt).toLocaleDateString(),
                order.serviceName,
                order.deliveryType,
                order.status,
                order.paymentMethod,
                money(order.totalAmount),
              ]
            ).map((value, i) =>
              (dashboard ? i === 4 : i === 5) ? (
                <View key={i} style={{ width: 132, alignItems: "flex-start" }}>
                  <StatusBadge status={order.status} />
                </View>
              ) : (
                <Txt
                  key={i}
                  style={{ width: 132, paddingRight: 12, fontSize: 12 }}
                  numberOfLines={2}
                >
                  {value}
                </Txt>
              ),
            )}
          </Pressable>
        ))}
        {!orders.length && (
          <Txt style={[styles.muted, { paddingVertical: 24 }]}>
            No Transaction Record
          </Txt>
        )}
      </View>
    </ScrollView>
  );
}
export function ShopHomeDesign() {
  const palette = usePalette();
  const { go } = useFlowNavigation();
  const owned = useOwnedShop();
  const orders = useOrders(true);
  const list = orders.data || [];
  return <Screen title="Dashboard" back={false} right={<IconButton label="Notifications" onPress={() => go("shop-notifications")}><Bell size={22} color={palette.primary} /></IconButton>}>
    <View style={styles.stack}>
      <View><Txt style={styles.title}>{owned.data?.shopName || "Your shop overview"}</Txt><Txt style={styles.muted}>Your shop’s performance at a glance.</Txt></View>
      <QueryState loading={owned.isLoading || orders.isLoading} error={owned.error || orders.error} retry={() => { owned.refetch(); orders.refetch(); }} />
      {owned.data && <LiveOperationsButton />}
      {owned.data && <DashboardAnalytics shopId={owned.data.id} />}
      {!owned.isLoading && !orders.isLoading && !owned.error && !orders.error && owned.data && <>
        <Card><Section title="Recent orders" action="View all" onPress={() => router.push("/shop/transactions")} /><TransactionsTable dashboard orders={list.slice(0, 4).map(order => ({ ...order, status: shopOrderStatus(order) }))} /></Card>
      </>}
      {owned.data && <Card style={{ padding: 0, overflow: "hidden" }}><View style={{ paddingHorizontal: 20 }}><Section title="Shop location" action="View map" onPress={() => go("shop-location")} /></View>
        <View style={{ height: 240 }}><LaundryMap latitude={owned.data.latitude} longitude={owned.data.longitude} shops={[owned.data]} onSelect={() => go("shop-location")} /></View></Card>}
      {!owned.isLoading && !owned.error && !owned.data && <Empty title="Set up your laundry shop" message="Register your shop to manage services and orders." action="Register your shop" onPress={() => go("register-shop")} />}
    </View>
  </Screen>;
}
export { ShopOrdersDesign as ShopTransactionsDesign } from "./ShopOrders";

// Preserve old Customers URLs and status shortcuts while using one Orders page.
export function CustomersDesign({ filter }: { filter?: Order["status"] }) {
  return <Redirect href={{ pathname: "/shop/transactions", params: filter ? { status: filter } : {} }} />;
}
export function ShopOrderDetailsDesign({
  id,
  transaction = false,
}: {
  id: number;
  transaction?: boolean;
}) {
  const palette = usePalette();
  const { go } = useFlowNavigation();
  const result = useOrders(true);
  const order = result.data?.find((o) => o.id === id);
  const [busy, setBusy] = useState(false);
  const [acceptanceExplanation, setAcceptanceExplanation] = useState("");
  const timerInFlight = useRef(false);
  const cache = useQueryClient();
  const [estimateDate, setEstimateDate] = useState("");
  const [estimateTime, setEstimateTime] = useState("");
  const [estimateReason, setEstimateReason] = useState("");
  async function startTimer(phase: "washing" | "drying") {
    if (timerInFlight.current || busy) return;
    timerInFlight.current = true;
    setBusy(true);
    try {
      await api.put(`/transactions/${id}/timer`, { phase });
      await Promise.all(["shop-orders", "user-orders", "notifications"].map(key => cache.invalidateQueries({ queryKey: [key] })));
    } catch (error) {
      fail(error);
      await cache.invalidateQueries({ queryKey: ["shop-orders"] });
    } finally { timerInFlight.current = false; setBusy(false); }
  }
  useEffect(() => {
    setEstimateDate(order?.estimatedReadyAt ? deliveryDay(order.estimatedReadyAt) : "");
    setEstimateTime(order?.estimatedReadyAt ? new Date(order.estimatedReadyAt).toLocaleTimeString("en-GB", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit" }) : "");
    setEstimateReason("");
  }, [id, order?.estimatedReadyAt]);
  async function update(status: Order["status"], extra: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      await api.put(`/transactions/${id}/status`, {
        status, ...extra,
        ...(status === "Accepted" ? { acceptanceExplanation: acceptanceExplanation.trim() } : {}),
      });
      await cache.invalidateQueries({ queryKey: ["shop-orders"] });
      await cache.invalidateQueries({ queryKey: ["shop-analytics"] });
      await cache.invalidateQueries({ queryKey: ["user-orders"] });
      await cache.invalidateQueries({ queryKey: ["notifications"] });
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }
  if (!order)
    return (
      <Screen title="Order">
        <QueryState
          loading={result.isLoading}
          error={result.error}
          retry={() => result.refetch()}
        />
        {!result.isLoading && !result.error && (
          <Empty title="Order not found" />
        )}
      </Screen>
    );
  if (order.workflowStatus) return <DeliveryOrderDesign id={id} partner />;
  return <OriginalOrderDetails order={order} partner
    timerActions={{ onStart: phase => { void startTimer(phase); }, busy }}
    right={order.status === "Pending" ? <Button title="Decline" compact outline onPress={() => go("decline-order", { id: String(id) })} /> : undefined}
    bookingFields={<View style={{ gap: 8 }}>
      <Field label="Acceptance explanation (required)" placeholder="Let the customer know why you can accept and what to expect."
        value={acceptanceExplanation} onChangeText={setAcceptanceExplanation} multiline maxLength={500} editable={!busy} />
      <Txt style={styles.muted}>This message will be shared with the customer when you accept.</Txt>
    </View>}
    primaryAction={!["Completed", "Cancelled"].includes(order.status) ? <Button
      title={({ Pending: "Accept order", Accepted: "Confirm laundry received", Queued: "Start processing", Processing: "Mark laundry ready", Ready: order.deliveryType === "Deliver" ? "Confirm delivered to customer" : "Confirm collected by customer" } as Record<string, string>)[order.status]}
      busy={busy} disabled={order.status === "Pending" && !acceptanceExplanation.trim()} onPress={async () => {
        const next = ({ Pending: "Accepted", Accepted: "Queued", Queued: "Processing", Processing: "Ready", Ready: "Completed" } as Record<string, Order["status"]>)[order.status];
        const prompts: Record<string, string> = { Accepted: "Accept this order? Processing will begin only when you select Start processing.", Queued: "Has the laundry arrived at the shop? It will enter your queue.", Processing: "Start processing now? The processing start time will be recorded.", Ready: "Is the laundry finished and ready for return?", Completed: order.deliveryType === "Deliver" ? "Has the customer received the return delivery?" : "Has the customer collected their finished laundry?" };
        if (await confirmAction("Update laundry status", prompts[next], { confirmLabel: "Confirm" })) await update(next);
      }} /> : undefined}
    confirmPickupAction={order.status === "Accepted" && order.requestedPickupAt && !order.confirmedPickupAt ? <Button title="Confirm requested laundry pickup" outline busy={busy} onPress={() => update(order.status, { confirmPickup: true })} /> : undefined}
    estimateEditor={["Queued", "Processing"].includes(order.status) ? <View style={{ gap: 10 }}>
      <Txt style={styles.muted}>Base the estimate on your queue. All times are Philippine time.</Txt>
      <PickerField label="Ready date" mode="date" value={estimateDate} onChange={setEstimateDate} />
      <PickerField label="Ready time" mode="time" value={estimateTime} onChange={setEstimateTime} />
      <Field label="Reason for revised estimate" placeholder="Example: More laundry in the queue" value={estimateReason} onChangeText={setEstimateReason} />
      <Button title={order.estimatedReadyAt ? "Update ready estimate" : "Send ready estimate"} outline busy={busy} onPress={() => {
        const time = timeInputValue(estimateTime);
        const timestamp = time && estimateDate ? Date.parse(estimateDate + "T" + time + ":00+08:00") : NaN;
        if (!Number.isFinite(timestamp) || timestamp <= Date.now()) { fail(new Error("Choose a future ready date and time.")); return; }
        void update(order.status, { estimatedReadyAt: new Date(timestamp).toISOString(), estimateReason });
      }} />
    </View> : undefined}
  />;
}
export function DeclineOrderDesign({
  id,
  stage = "decline-order",
  reason: initialReason = "",
}: {
  id: number;
  stage?: string;
  reason?: string;
}) {
  const palette = usePalette();
  const { go, replaceFlow } = useFlowNavigation();
  const [reason, setReason] = useState(initialReason);
  const [services, setServices] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const owned = useOwnedShop();
  const cache = useQueryClient();
  async function decline() {
    if (!id || !reason) return;
    setBusy(true);
    try {
      await api.put(`/transactions/${id}/status`, {
        status: "Cancelled",
        notes: reason + (services.length ? `: ${services.join(", ")}` : ""),
      });
      await cache.invalidateQueries({ queryKey: ["shop-orders"] });
      await cache.invalidateQueries({ queryKey: ["shop-analytics"] });
      replaceFlow("order-declined");
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }
  const reasons = [
    {
      label: "Shop closed",
      icon: "DeclineOrderIcon/Shop.png" as const,
      screen: "decline-closed",
    },
    {
      label: "Too busy",
      icon: "DeclineOrderIcon/Time.png" as const,
      screen: "decline-busy",
    },
    {
      label: "Service currently unavailable",
      icon: "DeclineOrderIcon/NotAvailable.png" as const,
      screen: "decline-services",
    },
    {
      label: "Other",
      icon: "DeclineOrderIcon/NotAvailable.png" as const,
      screen: "decline-services",
    },
  ];
  return (
    <Screen background={palette.surface} scroll={false}>
      <View style={[styles.grow, styles.center]}>
        <Card style={{ width: "100%", gap: 20, padding: 24 }}>
          <Txt style={styles.title}>
            {stage === "decline-order"
              ? "Select a reason\nfor declining."
              : stage === "decline-services"
                ? "Which services are unavailable?"
                : `Decline order #${id}?`}
          </Txt>
          <Txt style={styles.muted}>#{id}</Txt>
          {stage === "decline-order" ? (
            reasons.map((option) => (
              <Pressable accessibilityRole="button"
                key={option.label}
                onPress={() =>
                  go(option.screen, { id: String(id), reason: option.label })
                }
                style={[
                  styles.row,
                  {
                    borderWidth: 1,
                    borderColor: palette.line,
                    padding: 16,
                    borderRadius: 12,
                  },
                ]}
              >
                <Asset name={option.icon} size={32} />
                <Txt style={{ color: palette.navy, flex: 1 }}>
                  {option.label}
                </Txt>
              </Pressable>
            ))
          ) : (
            <>
              <Txt style={styles.muted}>
                {stage === "decline-closed"
                  ? "Make sure your shop is set to closed on your device."
                  : stage === "decline-busy"
                    ? "Make sure your shop is set to busy on your device."
                    : "Select the services that cannot be fulfilled for this order."}
              </Txt>
              {stage === "decline-services" &&
                (owned.data?.services || []).map((service) => (
                  <Choice
                    key={service.id}
                    label={service.serviceName}
                    square
                    selected={services.includes(service.serviceName)}
                    onPress={() =>
                      setServices(
                        services.includes(service.serviceName)
                          ? services.filter((s) => s !== service.serviceName)
                          : [...services, service.serviceName],
                      )
                    }
                  />
                ))}
              {reason === "Other" && (
                <Field label="Reason" value={reason} onChangeText={setReason} />
              )}
              <Button
                title="Yes, decline order"
                color={palette.primary}
                busy={busy}
                onPress={decline}
              />
            </>
          )}
          <Button
            title="Cancel"
            outline
            color={palette.navy}
            onPress={() => router.back()}
          />
        </Card>
      </View>
    </Screen>
  );
}
export function ShopProfileDesign() {
  const logout = useLogout();
  const palette = usePalette();
  const { go } = useFlowNavigation();
  const owned = useOwnedShop();
  const shop = owned.data;
  return (
    <Screen title="Shop Profile" back={false} background={palette.surface} padded={false}>
      <View style={{ height: 300, position: "relative", backgroundColor: "#17151B" }}>
        <ShopPhoto name={shop?.shopName || "Your Shop"} photoUrl={shop?.photoUrl}
          style={{ height: 300, aspectRatio: undefined, borderRadius: 0, backgroundColor: "#28242D" }} />
        <LinearGradient pointerEvents="none" colors={["#00000000", "#00000008", "#000000C9"]}
          locations={[0, 0.48, 1]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />
        <View style={{ position: "absolute", left: 20, right: 20, bottom: 34, gap: 7 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
            <Txt numberOfLines={1} style={{ color: "white", fontSize: 20, fontWeight: "700", flex: 1 }}>
              {shop?.shopName || "Your Shop"}
            </Txt>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
            <Clock size={15} color="white" strokeWidth={2} />
            <Txt numberOfLines={1} style={{ color: "white", fontSize: 13, fontWeight: "500", flex: 1 }}>
              {shop?.openingTime || "Opening time not set"} – {shop?.closingTime || "Closing time not set"}
            </Txt>
          </View>
        </View>
      </View>
      <View style={{ marginTop: -24, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: "white", padding: 16, paddingTop: 24, gap: 12 }}>
        <QueryState loading={owned.isLoading} error={owned.error} retry={() => owned.refetch()} />
        <MenuRow title="Account Information" asset="ProfileScreen/Profile.png" onPress={() => go("account-information")} />
        <MenuRow title="Shop Details" asset="ProfileScreen/Shop.png" onPress={() => go("shop-details")} />
        <MenuRow title="Security" asset="ProfileScreen/Security.png" onPress={() => go("security")} />
        <Button title="Switch to User Mode" icon={<UserRound size={18} color="white" />} onPress={() => router.replace("/(user)/profile")} />
        <MenuRow title="Logout" color={palette.danger} asset="ProfileScreen/Logout.png" onPress={logout} />
      </View>
    </Screen>
  );
}
export function ShopDetailsFormDesign() {
  const palette = usePalette();
  const owned = useOwnedShop();
  const cache = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initializedShop = useRef<number | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  useEffect(() => {
    if (owned.data && initializedShop.current !== owned.data.id) {
      initializedShop.current = owned.data.id;
      setValues({
      ...addressValues(owned.data, "Work"), shopName: owned.data.shopName,
      contactNumber: owned.data.contactNumber || "", openingTime: owned.data.openingTime || "", closingTime: owned.data.closingTime || "",
      pickupEnabled: String(owned.data.pickupEnabled || false),
      acceptingOrders: String(owned.data.acceptingOrders !== false),
      ...Object.fromEntries(distanceFields.map(field => [field, owned.data![field] == null ? "" : String(owned.data![field])]))
      });
    }
  }, [owned.data]);
  async function save() {
    if (!owned.data || busy) return;
    const validation = !timeInputValue(values.openingTime) || !timeInputValue(values.closingTime) ? "Choose valid opening and closing times." : addressError(values)
      || distanceSettingsError({ ...values, pickupEnabled: values.pickupEnabled === "true" });
    if (validation) { setError(validation); return; }
    setBusy(true); setError(null); setSavedMessage(null);
    try {
      const updated = await api.put<Shop>("/shops/" + owned.data.id, {
        ...addressPayload(values), shopName: values.shopName,
        contactNumber: values.contactNumber, openingTime: values.openingTime, closingTime: values.closingTime,
        pickupEnabled: values.pickupEnabled === "true",
        acceptingOrders: values.acceptingOrders !== "false",
        ...Object.fromEntries(distanceFields.map(field => [field, values[field]?.trim() ? Number(values[field]) : null]))
      });
      await cache.invalidateQueries({ queryKey: ["shop"] });
      await cache.invalidateQueries({ queryKey: ["shops"] });
      if (updated.approvalStatus === "Approved") {
        setSavedMessage("Changes saved. Your shop remains approved and visible.");
        return;
      }
      const auth = useAuthStore.getState();
      if (auth.user && auth.token) await auth.setAuth({ ...auth.user, isShopOwner: false }, auth.token);
      router.replace({ pathname: "/(flows)/[flow]", params: { flow: "register-shop" } });
    } catch (failure) { setError(message(failure)); }
    finally { setBusy(false); }
  }
  return <Screen title="Shop Details" background={palette.surface} footer={<View>
    {!!savedMessage && <Txt accessibilityLiveRegion="polite" style={{ color: palette.primary, marginBottom: 12 }}>{savedMessage}</Txt>}
    <FormError error={error} /><Button title="Save Changes" color={palette.navy} busy={busy} onPress={save} />
  </View>}>
    <View style={styles.stack}>
      <QueryState loading={owned.isLoading} error={owned.error} retry={() => owned.refetch()} />
      {owned.data && <ShopPhotoEditor shop={owned.data} />}
      <Txt style={styles.muted}>Hours, contact details, and service areas update immediately. Changing the shop name or location requires admin approval and pauses your listing and shop mode until reviewed.</Txt>
      <Card>
        <Field label="Shop ID" value={String(owned.data?.id || "")} editable={false} />
        {[["shopName", "Shop Name *"], ["contactNumber", "Contact Number *"]].map(([key, label]) =>
          <Field key={key} label={label} value={values[key] || ""} onChangeText={value => setValues(current => ({ ...current, [key]: value }))} />)}
        <Section title="Business Hours" />
        <Choice label="Accept orders during business hours" selected={values.acceptingOrders !== "false"}
          onPress={() => setValues(current => ({ ...current, acceptingOrders: current.acceptingOrders === "false" ? "true" : "false" }))} />
        <Txt style={styles.muted}>Turn this off to temporarily close your shop to new orders. Hours use Philippine time.</Txt>
        <View style={styles.row}>
          {[["openingTime", "Opening Time *", "08:00"], ["closingTime", "Closing Time *", "18:00"]].map(([key, label, initialValue]) =>
            <View key={key} style={styles.grow}><PickerField label={label} mode="time" value={values[key] || ""} initialValue={initialValue}
              onChange={value => setValues(current => ({ ...current, [key]: value }))} /></View>)}
        </View>
        <Section title="Shop Address" />
        <AddressFields values={values} setValues={setValues} />
        <Section title="Delivery & Laundry Collection Areas" />
        <Txt style={styles.muted}>Distances use a straight-line radius from your pinned shop location. Leave a minimum blank for 0 km and a maximum blank for no distance limit.</Txt>
        <Choice label="Offer laundry collection from customers" selected={values.pickupEnabled === "true"}
          onPress={() => setValues(current => ({ ...current, pickupEnabled: current.pickupEnabled === "true" ? "false" : "true" }))} />
        <Txt style={styles.muted}>Collection means your shop collects unwashed laundry at the customer's address. Customers may still collect finished laundry at your shop without a distance limit.</Txt>
        {distanceFields.filter(field => !field.startsWith("pickup") || values.pickupEnabled === "true").map(field =>
          <Field key={field} label={`${field.startsWith("delivery") ? "Delivery" : "Collection"} ${field.includes("Min") ? "minimum" : "maximum"} distance (km)`}
            keyboardType="decimal-pad" suffix="km" placeholder={field.includes("Min") ? "0" : "No limit"}
            value={values[field] || ""} onChangeText={value => setValues(current => ({ ...current, [field]: value }))} />)}
      </Card>
    </View>
  </Screen>;
}
export function ServicesDesign() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const owned = useOwnedShop();
  const detail = useShop(owned.data?.id || 0);
  const shop = detail.data || owned.data;
  const [dialog, setDialog] = useState<"service" | "price" | null>(null);
  const [editing, setEditing] = useState<Service | KiloPrice | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [color, setColor] = useState(palette.primary);
  const [packagePricing, setPackagePricing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deleting = useRef(false);
  const cache = useQueryClient();
  function open(kind: "service" | "price", item?: Service | KiloPrice) {
    setDialog(kind);
    setEditing(item || null);
    setError(null);
    setPackagePricing(!item || ("packageKilos" in item && item.packageKilos != null));
    setValues(
      kind === "service"
        ? {
          serviceName: item && "serviceName" in item ? item.serviceName : "",
          price: item && "price" in item ? String(item.price) : "",
          packageKilos: item && "packageKilos" in item && item.packageKilos != null ? String(item.packageKilos) : "",
          washingMinutes: item && "washingMinutes" in item && item.washingMinutes != null ? String(item.washingMinutes) : "",
          dryingMinutes: item && "dryingMinutes" in item && item.dryingMinutes != null ? String(item.dryingMinutes) : "",
        }
        : {
          minKilo: item && "minKilo" in item ? String(item.minKilo) : "1",
          maxKilo: item && "maxKilo" in item ? String(item.maxKilo) : "12",
          pricePerKilo:
            item && "pricePerKilo" in item ? String(item.pricePerKilo) : "",
        },
    );
    const currentColor = item && "color" in item ? normalizeServiceColor(item.color) : "";
    setColor(currentColor || serviceColorOptions.find(option => !serviceColorTaken(shop?.services || [], option.color, item?.id))?.color || "");
  }
  function setDecimalValue(key: string, value: string) {
    if (/^\d*(?:\.\d*)?$/.test(value)) setValues(current => ({ ...current, [key]: value }));
  }
  function setWholeNumberValue(key: string, value: string) {
    if (/^\d*$/.test(value)) setValues(current => ({ ...current, [key]: value }));
  }
  async function save() {
    if (!shop || busy) return;
    if (editing && dialog === "price") return unavailable("Edit price range");
    if (dialog === "service" && (!color || serviceColorTaken(shop.services || [], color, editing?.id)))
      return setError("Choose a color that is not already used by another service.");
    const activeValues = Object.entries(values).filter(([key]) => key !== "packageKilos" || packagePricing);
    if (
      activeValues.some(([, value]) => !value.trim()) ||
      activeValues.some(
        ([key, value]) =>
          key !== "serviceName" &&
          (!Number.isFinite(Number(value)) || Number(value) < 0),
      )
    )
      return setError("Please enter a service name and valid numbers in every required field.");
    if (dialog === "service" && (Number(values.price) > 99999999.99 || Number(Number(values.price).toFixed(2)) !== Number(values.price)))
      return setError("Enter a price with up to two decimal places, no higher than 99,999,999.99.");
    if (dialog === "service" && packagePricing &&
      (Number(values.packageKilos) <= 0 || Number(values.packageKilos) > 99999999.99 || Number(Number(values.packageKilos).toFixed(2)) !== Number(values.packageKilos)))
      return setError("Enter a package weight above 0 kg with up to two decimal places, no higher than 99,999,999.99.");
    if (dialog === "service" && [values.washingMinutes, values.dryingMinutes].some(value =>
      !Number.isInteger(Number(value)) || Number(value) <= 0 || Number(value) > 10080))
      return setError("Enter washing and drying times from 1 to 10,080 minutes.");
    if (dialog === "price" && Number(values.maxKilo) <= Number(values.minKilo))
      return setError("Maximum weight must be greater than minimum weight.");
    setBusy(true);
    setError(null);
    try {
      const write = editing ? api.put : api.post;
      await write(
        `/shops/${shop.id}/${dialog === "service" ? "services" : "kilo-prices"}${editing ? `/${editing.id}` : ""}`,
        dialog === "service"
          ? {
            serviceName: values.serviceName.trim(),
            price: Number(values.price),
            packageKilos: packagePricing ? Number(values.packageKilos) : null,
            washingMinutes: Number(values.washingMinutes),
            dryingMinutes: Number(values.dryingMinutes),
            color,
          }
          : {
            minKilo: Number(values.minKilo),
            maxKilo: Number(values.maxKilo),
            pricePerKilo: Number(values.pricePerKilo),
          },
      );
      await cache.invalidateQueries({ queryKey: ["shop"] });
      await cache.invalidateQueries({ queryKey: ["shops"] });
      setDialog(null);
    } catch (failure) {
      setError(message(failure));
      if (dialog === "service") void cache.invalidateQueries({ queryKey: ["shop"] });
    } finally {
      setBusy(false);
    }
  }
  async function removeService(service: Service) {
    if (!shop || busy || deleting.current) return;
    deleting.current = true;
    setError(null);
    try {
      if (!await confirmAction("Delete Service", `Delete "${service.serviceName}"? Existing orders will stay available.`, { confirmLabel: "Delete Service", destructive: true })) return;
      setBusy(true);
      await api.delete(`/shops/${shop.id}/services/${service.id}`);
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["shop"] }),
        cache.invalidateQueries({ queryKey: ["shops"] }),
      ]);
      if (editing?.id === service.id && dialog === "service") setDialog(null);
    } catch (failure) { setError(message(failure)); }
    finally { deleting.current = false; setBusy(false); }
  }
  return (
    <Screen
      title="Services"
      back={false}
      right={
        <Button title="Add Service" compact color="white" textColor={palette.primary} disabled={busy}
          icon={<Plus size={18} color={palette.primary} />} onPress={() => open("service")} />
      }
    >
      <View style={[styles.stack, { width: "100%", maxWidth: 1100, alignSelf: "center" }]}>
        <QueryState
          loading={owned.isLoading || detail.isLoading}
          error={owned.error || detail.error}
          retry={() => {
            owned.refetch();
            detail.refetch();
          }}
        />
        <Section title="YOUR SERVICES" />
        {!dialog && <FormError error={error} />}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {shop?.services?.map((service) => {
            const cardColors = serviceCardColors(service.color, palette.primary);
            return (
            <View
              key={service.id}
              testID={`service-card-${service.id}`}
              style={{
                flexBasis: 280,
                maxWidth: "100%",
                flexGrow: 1,
                padding: 18,
                borderRadius: 12,
                backgroundColor: cardColors.background, borderWidth: 1, borderColor: cardColors.background,
                gap: 8,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
                <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
                  <Txt style={{ fontWeight: "700", fontSize: 20, lineHeight: 28, color: cardColors.foreground }}>
                    {service.serviceName}
                  </Txt>
                  <Txt style={{ color: cardColors.foreground, fontWeight: "700", fontSize: 28, lineHeight: 36 }}>
                    {money(service.price)}<Txt style={{ color: cardColors.foreground, fontWeight: "700", fontSize: 18 }}> / {service.packageKilos != null ? "load" : "kg"}</Txt>
                  </Txt>
                  {service.packageKilos != null && <View style={{ alignSelf: "flex-start", borderRadius: 8, paddingVertical: 4, paddingHorizontal: 9, backgroundColor: cardColors.detailBackground }}>
                    <Txt style={{ color: cardColors.foreground, fontSize: 12, fontWeight: "500" }}>Up to {Number(service.packageKilos)} kg per load</Txt>
                  </View>}
                </View>
                <View style={{ gap: 8 }}>
                  <Pressable accessibilityRole="button" accessibilityLabel="Edit" accessibilityHint={"Edit " + service.serviceName}
                    disabled={busy} accessibilityState={{ disabled: busy }} onPress={() => open("service", service)}
                    hitSlop={6}
                    style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 10, backgroundColor: "white", alignItems: "center", justifyContent: "center", opacity: busy ? 0.5 : pressed ? 0.8 : 1 })}>
                    <Pencil size={16} color={palette.primary} />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="Delete" accessibilityHint={"Delete " + service.serviceName}
                    disabled={busy} accessibilityState={{ disabled: busy }} onPress={() => removeService(service)}
                    hitSlop={6}
                    style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 10, backgroundColor: "white", alignItems: "center", justifyContent: "center", opacity: busy ? 0.5 : pressed ? 0.8 : 1 })}>
                    <Trash2 size={16} color={palette.danger} />
                  </Pressable>
                </View>
              </View>
            </View>
          );
          })}
        </View>
        {!owned.isLoading && !detail.isLoading && !owned.error && !detail.error && !shop?.services?.length && (
          <Empty
            title="No services added yet"
            action="Add Service"
            onPress={() => open("service")}
          />
        )}
        <Section title="KILO PRICING" />
        <MenuRow
          title="Price per Kilo Settings"
          detail={`${shop?.kiloPrices?.length || 0} price ranges set`}
          onPress={() => open("price")}
        />
        <Card>
          <Section title="Current Price Ranges" />
          {shop?.kiloPrices?.map((range) => (
            <Pressable accessibilityRole="button" key={range.id} onPress={() => open("price", range)}>
              <View style={styles.between}>
                <Txt>
                  {range.minKilo}kg – {range.maxKilo}kg
                </Txt>
                <Txt style={{ color: palette.navy, fontWeight: "600" }}>
                  {money(range.pricePerKilo)}/kg
                </Txt>
                <Pencil size={16} color={palette.navy} />
              </View>
            </Pressable>
          ))}
          {!shop?.kiloPrices?.length && (
            <Txt style={styles.muted}>No price ranges set</Txt>
          )}
          <Button
            title="Add Price Range"
            compact
            outline
            color={palette.navy}
            onPress={() => open("price")}
            style={{ alignSelf: "flex-start" }}
          />
        </Card>
      </View>
      <Modal visible={!!dialog} transparent animationType="none" onRequestClose={() => { if (!busy) setDialog(null); }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={{
            flex: 1, backgroundColor: "#00000070", alignItems: "center", justifyContent: "center",
            paddingHorizontal: 14, paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16),
          }}>
            <Card testID="service-editor" style={{ width: "100%", maxWidth: 440, maxHeight: "100%", flexShrink: 1, padding: 18, gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <Txt accessibilityRole="header" style={styles.heading}>
                  {editing ? "Edit" : "Add"} {dialog === "service" ? "Service" : "Price Range"}
                </Txt>
                <Pressable accessibilityRole="button" accessibilityLabel="Close service editor" disabled={busy}
                  onPress={() => setDialog(null)}
                  style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: palette.surface, opacity: busy ? 0.5 : 1 }}>
                  <X size={20} color={palette.primary} />
                </Pressable>
              </View>
              <ScrollView testID="service-editor-body" style={{ flexShrink: 1, flexGrow: 0, minHeight: 0 }}
                keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingBottom: 2 }}>
                {dialog === "service" ? (
                  <>
                    <Field compact label="Service Name" value={values.serviceName} editable={!busy} autoCapitalize="words"
                      onChangeText={(serviceName) => setValues({ ...values, serviceName })} />
                    <View style={{ gap: 6 }}>
                      <Txt style={{ fontSize: 12, fontWeight: "500" }}>Pricing type</Txt>
                      <View accessibilityRole="radiogroup" accessibilityLabel="Service pricing type"
                        style={{ flexDirection: "row", padding: 3, borderRadius: 12, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line }}>
                        {[{ label: "Per load", description: "Fixed price per load", selected: packagePricing }, { label: "Per kilogram", description: "Price per kilogram", selected: !packagePricing }].map(option =>
                          <Pressable key={option.label} accessibilityRole="radio" accessibilityLabel={option.description}
                            accessibilityState={{ checked: option.selected, disabled: busy }} disabled={busy}
                            onPress={() => setPackagePricing(option.label === "Per load")}
                            style={{ flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: option.selected ? palette.primary : "transparent" }}>
                            <Txt style={{ fontSize: 13, fontWeight: "600", color: option.selected ? "white" : palette.muted }}>{option.label}</Txt>
                          </Pressable>)}
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-end" }}>
                      {packagePricing && <View style={{ flex: 1, minWidth: 0 }}>
                        <Field compact label="Weight per load" placeholder="e.g. 8" suffix="kg"
                          value={values.packageKilos} keyboardType="decimal-pad" inputMode="decimal" editable={!busy}
                          onChangeText={value => setDecimalValue("packageKilos", value)} />
                      </View>}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Field compact label={packagePricing ? "Price per load" : "Price per kilogram"} suffix="₱"
                          placeholder={packagePricing ? "e.g. 215" : "e.g. 25"} value={values.price}
                          keyboardType="decimal-pad" inputMode="decimal" editable={!busy}
                          onChangeText={value => setDecimalValue("price", value)} />
                      </View>
                    </View>
                    {packagePricing && <Txt style={{ color: palette.muted, fontSize: 12, lineHeight: 18 }}>
                      {Number(values.packageKilos) > 0 ? "Each load covers up to " + values.packageKilos + " kg. " : ""}
                      Extra weight counts as another load.
                    </Txt>}
                    <View style={{ flexDirection: "row", gap: 12 }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Field compact label="Standard washing time" placeholder="e.g. 30" suffix="min"
                          value={values.washingMinutes} keyboardType="number-pad" inputMode="numeric" editable={!busy}
                          onChangeText={value => setWholeNumberValue("washingMinutes", value)} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Field compact label="Standard drying time" placeholder="e.g. 45" suffix="min"
                          value={values.dryingMinutes} keyboardType="number-pad" inputMode="numeric" editable={!busy}
                          onChangeText={value => setWholeNumberValue("dryingMinutes", value)} />
                      </View>
                    </View>
                    <View style={{ gap: 4 }}>
                      <Txt style={{ fontSize: 12, fontWeight: "500" }}>Service color</Txt>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        {[...serviceColorOptions, ...(!color || serviceColorOptions.some(option => option.color === color) ? [] : [{ color, name: "Current color" }])].map(option => {
                          const value = option.color;
                          const taken = serviceColorTaken(shop?.services || [], value, editing?.id);
                          return <Pressable key={value} accessibilityRole="button" accessibilityLabel={"Service color " + value}
                            accessibilityHint={option.name + (taken ? ": already used by another service" : "")}
                            accessibilityState={{ selected: color === value, disabled: busy || taken }} disabled={busy || taken} onPress={() => setColor(value)}
                            style={{ width: 40, height: 40, padding: 4, borderRadius: 13, borderWidth: 2, borderColor: color === value ? palette.primary : "transparent", opacity: busy || taken ? 0.45 : 1 }}>
                            <View style={{ flex: 1, borderRadius: 9, backgroundColor: value, alignItems: "center", justifyContent: "center" }}>
                              {taken ? <X size={15} strokeWidth={2.5} color={serviceCardColors(value, palette.primary).foreground} /> : color === value && <Check size={18} strokeWidth={3} color={serviceCardColors(value, palette.primary).foreground} />}
                            </View>
                          </Pressable>;
                        })}
                      </View>
                      <Txt style={{ color: palette.muted, fontSize: 11, lineHeight: 16 }}>{color ? "Crossed-out colors are already in use." : "All colors are in use. Free a color by changing or deleting an existing service."}</Txt>
                    </View>
                    {editing && "serviceName" in editing && <Button title="Delete Service" compact outline color={palette.danger}
                      disabled={busy} style={{ alignSelf: "flex-start" }} onPress={() => removeService(editing)} />}
                  </>
                ) : (
                  <>
                    {!editing ? <WeightRangeSlider minimum={Number(values.minKilo || 1)} maximum={Number(values.maxKilo || 12)} disabled={busy}
                      onChange={(minimum, maximum) => setValues(current => ({ ...current, minKilo: String(minimum), maxKilo: String(maximum) }))} /> : <View style={{ flexDirection: "row", gap: 12 }}>
                      {[{ key: "minKilo", label: "Minimum Weight (kg)" }, { key: "maxKilo", label: "Maximum Weight (kg)" }].map(field =>
                        <View key={field.key} style={{ flex: 1, minWidth: 0 }}>
                          <Field compact label={field.label} keyboardType="decimal-pad" inputMode="decimal" suffix="kg" editable={false}
                            value={values[field.key]} onChangeText={value => setDecimalValue(field.key, value)} />
                        </View>)}
                    </View>}
                    <Field compact label="Price per Kilogram" keyboardType="decimal-pad" inputMode="decimal" suffix="₱" editable={!busy}
                      value={values.pricePerKilo} onChangeText={value => setDecimalValue("pricePerKilo", value)} />
                    {editing && <Txt style={{ color: palette.muted, fontSize: 12 }}>Editing existing weight ranges is not available. You can add a new range.</Txt>}
                  </>
                )}
                <FormError error={error} />
              </ScrollView>
              <View testID="service-editor-actions" style={{ flexDirection: "row", gap: 10, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 12 }}>
                <Button title="Cancel" compact disabled={busy} outline color={palette.navy}
                  onPress={() => setDialog(null)} style={{ flex: 1 }} />
                <Button title={editing ? "Save Changes" : dialog === "service" ? "Add Service" : "Add Range"} compact busy={busy}
                  disabled={!!editing && dialog === "price" || dialog === "service" && (!color || serviceColorTaken(shop?.services || [], color, editing?.id))} color={palette.navy} onPress={save} style={{ flex: 1 }} />
              </View>
            </Card>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}
