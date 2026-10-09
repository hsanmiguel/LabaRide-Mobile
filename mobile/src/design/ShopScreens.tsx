import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, View } from "react-native";
import {
  Bell,
  ChevronRight,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";
import {
  Asset,
  Brand,
  Button,
  Card,
  Choice,
  Empty,
  Field,
  MenuRow,
  PriceRow,
  Screen,
  SearchBox,
  Section,
  TabsRow,
  Txt,
  money,
  palette,
  styles,
} from "./ui";
import {
  address,
  api,
  fail,
  useFlowNavigation,
  unavailable,
  useOrders,
  useOwnedShop,
  useProfile,
  useShop,
  type KiloPrice,
  type Order,
  type Profile,
  type Service,
} from "./data";
import { OrderCard, StatusBadge, Totals } from "./OrderScreens";
import { QueryState } from "./UserScreens";
import LaundryMap from "./LaundryMap";
import { AddressFields, DeliveryDetails, FormError } from "./AddressFields";
import { addressError, addressPayload, addressValues } from "./address";
import { message, type Shop } from "./data";
import PickerField from "./PickerField";
import { timeInputValue } from "./form-values";

const statusLabels: Record<Order["status"], string> = {
  Pending: "New Orders",
  Processing: "Ongoing Orders",
  Completed: "Completed Orders",
  Cancelled: "Cancelled Orders",
};
export function RegisterShopDesign() {
  const [values, setValues] = useState<Record<string, string>>({
    shopName: "", contactNumber: "", openingTime: "", closingTime: "", ...addressValues(null, "Work"),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const auth = useAuthStore();
  const owned = useOwnedShop();
  const cache = useQueryClient();
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
      const result = await api.post<Shop & { user: Profile; token: string }>("/shops", {
        shopName: values.shopName.trim(), contactNumber: values.contactNumber.trim(),
        openingTime: values.openingTime.trim(), closingTime: values.closingTime.trim(), ...addressPayload(values),
      });
      await auth.setAuth(result.user, result.token);
      cache.setQueryData(["user", result.user.id], result.user);
      const { user, token, ...shop } = result;
      cache.setQueryData(["shop", "owner", user.id], shop);
      void cache.invalidateQueries({ queryKey: ["shops"] });
      router.replace("/shop/home");
    } catch (failure) {
      setError(message(failure));
      void owned.refetch();
    } finally { setBusy(false); }
  }
  return <Screen>
    <View style={{ padding: 8, paddingTop: 24 }}>
      <Brand compact />
      <Txt style={[styles.title, { fontSize: 30, marginVertical: 24 }]}>Register your shop</Txt>
      {owned.data ? <Card>
        <Txt style={styles.heading}>Your shop is already registered</Txt>
        <Txt style={styles.muted}>{owned.data.shopName}</Txt>
        <FormError error={error} />
        <Button title="Open My Shop" busy={busy} onPress={openExistingShop} />
      </Card> : <>
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
        <Button title="Register Shop" busy={busy} onPress={submit} style={{ marginVertical: 24 }} />
      </>}
    </View>
  </Screen>;
}
export function TransactionsTable({
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
  const { go } = useFlowNavigation();
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
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
          <Pressable
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
              dashboard && i === 4 ? (
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
  const { go } = useFlowNavigation();
  const owned = useOwnedShop();
  const orders = useOrders(true);
  const today = new Date().toDateString();
  const count =
    orders.data?.filter(
      (order) => new Date(order.createdAt).toDateString() === today,
    ).length || 0;
  return (
    <Screen
      title="DASHBOARD"
      dark
      back={false}
      background={palette.purple}
      right={
        <Pressable
          accessibilityLabel="Notifications"
          onPress={() => go("shop-notifications")}
        >
          <Asset name="adminIcon/bell.png" tint="white" size={24} />
        </Pressable>
      }
    >
      <View style={styles.stack}>
        <View style={{ height: 200, borderRadius: 12, overflow: "hidden" }}>
          <LaundryMap
            latitude={owned.data?.latitude}
            longitude={owned.data?.longitude}
            shops={owned.data ? [owned.data] : []}
            onSelect={() => go("shop-location")}
          />
        </View>
        <Card>
          <Section title="TOTAL ORDERS TODAY" />
          <View style={styles.center}>
            <Txt
              style={{ fontSize: 48, fontWeight: "700", color: palette.navy }}
            >
              {count}
            </Txt>
            <Txt style={styles.muted}>Orders</Txt>
          </View>
        </Card>
        <Card>
          <Section title="RECENT TRANSACTIONS" />
          <QueryState
            loading={orders.isLoading || owned.isLoading}
            error={orders.error || owned.error}
            retry={() => {
              owned.refetch();
              orders.refetch();
            }}
          />
          <TransactionsTable
            dashboard
            orders={(orders.data || []).slice(0, 10)}
          />
        </Card>
        {!owned.isLoading && !owned.data && (
          <Button
            title="Register your shop"
            onPress={() => go("register-shop")}
          />
        )}
      </View>
    </Screen>
  );
}
export function ShopTransactionsDesign() {
  const { go } = useFlowNavigation();
  const orders = useOrders(true);
  const [tab, setTab] = useState("All");
  const [selection, setSelection] = useState<number[]>([]);
  const filters: Record<string, string> = {
    All: "",
    Cancelled: "Cancelled",
    "In Progress": "Processing",
    Completed: "Completed",
  };
  const filtered = (orders.data || []).filter(
    (o) => !filters[tab] || o.status === filters[tab],
  );
  return (
    <Screen
      title="TRANSACTIONS"
      dark
      back={false}
      background={palette.navy}
      footer={
        selection.length ? (
          <View style={styles.row}>
            <Button
              title="Back"
              outline
              color={palette.navy}
              onPress={() => setSelection([])}
            />
            <Button
              title="View Transaction"
              color={palette.navy}
              disabled={selection.length !== 1}
              onPress={() =>
                go("shop-transaction", { id: String(selection[0]) })
              }
              style={styles.grow}
            />
            <Pressable
              accessibilityLabel="Delete selected transactions"
              onPress={() => unavailable("Delete transactions")}
            >
              <Trash2 color={palette.danger} size={22} />
            </Pressable>
          </View>
        ) : undefined
      }
    >
      <View style={styles.stack}>
        <TabsRow
          items={Object.keys(filters)}
          value={tab}
          onChange={setTab}
          color="white"
        />
        <Card style={{ borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
          <QueryState
            loading={orders.isLoading}
            error={orders.error}
            retry={() => orders.refetch()}
          />
          <TransactionsTable
            orders={filtered}
            selectable
            selection={selection}
            onSelect={(id) =>
              setSelection(
                selection.includes(id)
                  ? selection.filter((i) => i !== id)
                  : [...selection, id],
              )
            }
          />
        </Card>
      </View>
    </Screen>
  );
}
export function CustomersDesign({ filter }: { filter?: Order["status"] }) {
  const { go } = useFlowNavigation();
  const orders = useOrders(true);
  const [query, setQuery] = useState("");
  const statuses: Order["status"][] = [
    "Pending",
    "Cancelled",
    "Processing",
    "Completed",
  ];
  const filtered = (orders.data || []).filter(
    (order) =>
      (!filter || order.status === filter) &&
      `${order.id} ${order.userName} ${order.serviceName}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <Screen title="Customer Orders" back={!!filter} background="#48006A" dark>
      <View style={styles.stack}>
        {filter ? (
          <>
            <Section title={statusLabels[filter]} light />
            <SearchBox
              placeholder="Search..."
              value={query}
              onChangeText={setQuery}
            />
          </>
        ) : null}
        <QueryState
          loading={orders.isLoading}
          error={orders.error}
          retry={() => orders.refetch()}
        />
        {filter
          ? filtered.map((order) => (
            <OrderCard key={order.id} order={order} shopMode />
          ))
          : statuses.map((status) => {
            const list = (orders.data || []).filter(
              (o) => o.status === status,
            );
            return (
              <View key={status}>
                <Section title={statusLabels[status]} light />
                <Pressable onPress={() => go("shop-customers", { status })}>
                  <Card style={{ minHeight: 80, justifyContent: "center" }}>
                    {!list.length ? (
                      <Txt style={{ textAlign: "center" }}>
                        No{" "}
                        {status === "Processing"
                          ? "ongoing"
                          : status === "Pending"
                            ? "new"
                            : status.toLowerCase()}{" "}
                        orders yet.
                      </Txt>
                    ) : status === "Processing" ? (
                      <>
                        <View style={styles.between}>
                          <Txt style={{ fontWeight: "600" }}>
                            #{list[0].id}
                          </Txt>
                          <Txt style={styles.muted}>
                            {new Date(list[0].createdAt).toLocaleDateString()}
                          </Txt>
                        </View>
                        <View style={styles.between}>
                          <Txt
                            style={{ color: "#00897B", fontWeight: "600" }}
                          >
                            {list[0].serviceName.toUpperCase()}
                          </Txt>
                          <Txt>{money(list[0].totalAmount)}</Txt>
                        </View>
                      </>
                    ) : (
                      <View style={[styles.row, styles.center]}>
                        <Txt
                          style={{
                            fontSize: 24,
                            color:
                              status === "Cancelled"
                                ? palette.danger
                                : palette.navy,
                            fontWeight: "700",
                          }}
                        >
                          {list.length}
                        </Txt>
                        <Txt>{statusLabels[status]}</Txt>
                        <ChevronRight size={18} color={palette.navy} />
                      </View>
                    )}
                  </Card>
                </Pressable>
              </View>
            );
          })}
        {filter && !orders.isLoading && !filtered.length && (
          <Card>
            <Empty title={`No ${statusLabels[filter].toLowerCase()} yet.`} />
          </Card>
        )}
      </View>
    </Screen>
  );
}
export function ShopOrderDetailsDesign({
  id,
  transaction = false,
}: {
  id: number;
  transaction?: boolean;
}) {
  const { go } = useFlowNavigation();
  const result = useOrders(true);
  const order = result.data?.find((o) => o.id === id);
  const [busy, setBusy] = useState(false);
  const cache = useQueryClient();
  async function update(status: Order["status"]) {
    setBusy(true);
    try {
      await api.put(`/transactions/${id}/status`, { status });
      await cache.invalidateQueries({ queryKey: ["shop-orders"] });
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
  return (
    <Screen
      title={`#${order.id}`}
      dark={!transaction}
      background={transaction ? "white" : "#48006A"}
      right={
        order.status === "Pending" && (
          <Pressable onPress={() => go("decline-order", { id: String(id) })}>
            <Txt style={{ color: "#FF8888" }}>Decline</Txt>
          </Pressable>
        )
      }
      footer={
        order.status === "Pending" ? (
          <Button
            title="Accept"
            color="#9747FF"
            busy={busy}
            onPress={() => update("Processing")}
          />
        ) : order.status === "Processing" ? (
          <Button
            title="Complete Order"
            color="#00B140"
            busy={busy}
            onPress={() =>
              Alert.alert("Complete Order", "Mark this order as completed?", [
                { text: "Cancel" },
                { text: "Confirm", onPress: () => update("Completed") },
              ])
            }
          />
        ) : undefined
      }
    >
      <Card style={{ borderRadius: 16, padding: 20 }}>
        <View style={styles.between}>
          <Txt style={{ fontSize: 24, fontWeight: "700", color: palette.navy }}>
            Order
          </Txt>
          <StatusBadge status={order.status} />
        </View>
        <Section title="Customer Details" />
        <PriceRow label="Customer ID" value={String(order.userId)} />
        <PriceRow label="Customer" value={order.userName} />
        <PriceRow label="Contact" value={order.userPhone || "—"} />
        <Section title={order.deliveryType === "Pickup" ? "Pickup Location" : "Delivery Address"} />
        <Txt style={styles.muted}>{address(order)}</Txt>
        <DeliveryDetails value={order} />
        <Section title="Order Details" />
        <View
          style={{ backgroundColor: "#98D8BF", padding: 16, borderRadius: 12 }}
        >
          <Txt style={styles.heading}>{order.serviceName}</Txt>
          <Txt>
            {order.kiloAmount} kg · {order.deliveryType}
          </Txt>
        </View>
        <Section title="Types of clothes:" />
        {order.items?.length ? (
          order.items.map((item) => (
            <PriceRow
              key={item.itemName}
              label={item.itemName}
              value={`×${item.quantity}`}
            />
          ))
        ) : (
          <Txt style={styles.muted}>No items listed</Txt>
        )}
        <Section title="Household items:" />
        <Txt style={styles.muted}>Included in the laundry items above</Txt>
        <View style={styles.divider} />
        <Totals order={order} />
        <Section
          title={transaction ? "Payment Information" : "Customer Details"}
        />
        <PriceRow label="Payment Type" value={order.paymentMethod} />
        <PriceRow
          label="Scheduled Date"
          value={new Date(order.scheduledDate).toLocaleDateString()}
        />
        {order.notes && (
          <>
            <Section
              title={
                order.status === "Cancelled" ? "Reason of cancellation" : "Note"
              }
            />
            <Txt style={styles.muted}>{order.notes}</Txt>
          </>
        )}
        {order.status === "Processing" && (
          <View
            style={{
              backgroundColor: "#00B140",
              padding: 16,
              borderRadius: 16,
            }}
          >
            <Txt style={{ color: "white", fontSize: 16, fontWeight: "600" }}>
              In Progress
            </Txt>
          </View>
        )}
      </Card>
    </Screen>
  );
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
    <Screen background={palette.lavender} scroll={false}>
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
              <Pressable
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
                color="#9747FF"
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
  const { go } = useFlowNavigation();
  const owned = useOwnedShop();
  const profile = useProfile();
  const shop = owned.data;
  return (
    <Screen background="white" padded={false}>
      <View
        style={{
          backgroundColor: palette.navy,
          paddingTop: 24,
          alignItems: "center",
        }}
      >
        <Txt style={{ color: "white", fontSize: 28, fontWeight: "700" }}>
          {shop?.shopName || "Your Shop"}
        </Txt>
        <Txt style={{ color: "white", fontSize: 16, marginTop: 8 }}>
          {shop?.contactNumber || "Contact Number"}
        </Txt>
        <View
          style={{
            marginTop: 40,
            borderTopLeftRadius: 25,
            borderTopRightRadius: 25,
            padding: 20,
            backgroundColor: "white",
            width: "100%",
            gap: 8,
          }}
        >
          <Txt style={styles.title}>{shop?.shopName || "Your Shop"}</Txt>
          <Txt style={styles.muted}>#{shop?.id || ""}</Txt>
          <Txt style={styles.muted}>
            {profile.data?.name || useAuthStore.getState().user?.name}
          </Txt>
          <Txt style={styles.muted}>{profile.data?.email}</Txt>
          <Txt style={styles.muted}>Contact: {shop?.contactNumber || "—"}</Txt>
          <Txt style={styles.muted}>
            {shop?.openingTime || "—"} – {shop?.closingTime || "—"}
          </Txt>
        </View>
      </View>
      <View style={{ padding: 16, gap: 12 }}>
        <QueryState
          loading={owned.isLoading}
          error={owned.error}
          retry={() => owned.refetch()}
        />
        <MenuRow
          title="Account Information"
          asset="ProfileScreen/Profile.png"
          onPress={() => go("account-information")}
        />
        <MenuRow
          title="Shop Details"
          asset="ProfileScreen/Shop.png"
          onPress={() => go("shop-details")}
        />
        <MenuRow
          title="Security"
          asset="ProfileScreen/Security.png"
          onPress={() => go("security")}
        />
        <Button
          title="Switch to User Mode"
          onPress={() => router.replace("/(user)/profile")}
        />
        <MenuRow
          title="Logout"
          color={palette.danger}
          asset="ProfileScreen/Logout.png"
          onPress={() => go("logout")}
        />
      </View>
    </Screen>
  );
}
export function ShopDetailsFormDesign() {
  const owned = useOwnedShop();
  const cache = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (owned.data) setValues({
      ...addressValues(owned.data, "Work"), shopName: owned.data.shopName,
      contactNumber: owned.data.contactNumber || "", openingTime: owned.data.openingTime || "", closingTime: owned.data.closingTime || ""
    });
  }, [owned.data]);
  async function save() {
    if (!owned.data || busy) return;
    const validation = !timeInputValue(values.openingTime) || !timeInputValue(values.closingTime) ? "Choose valid opening and closing times." : addressError(values);
    if (validation) { setError(validation); return; }
    setBusy(true); setError(null);
    try {
      await api.put<Shop>("/shops/" + owned.data.id, {
        ...addressPayload(values), shopName: values.shopName,
        contactNumber: values.contactNumber, openingTime: values.openingTime, closingTime: values.closingTime
      });
      await cache.invalidateQueries({ queryKey: ["shop"] });
      await cache.invalidateQueries({ queryKey: ["shops"] });
      router.back();
    } catch (failure) { setError(message(failure)); }
    finally { setBusy(false); }
  }
  return <Screen title="Shop Details" background={palette.lavender} footer={<View>
    <FormError error={error} /><Button title="Save Changes" color={palette.navy} busy={busy} onPress={save} />
  </View>}>
    <View style={styles.stack}>
      <QueryState loading={owned.isLoading} error={owned.error} retry={() => owned.refetch()} />
      <Card>
        <Field label="Shop ID" value={String(owned.data?.id || "")} editable={false} />
        {[["shopName", "Shop Name *"], ["contactNumber", "Contact Number *"]].map(([key, label]) =>
          <Field key={key} label={label} value={values[key] || ""} onChangeText={value => setValues(current => ({ ...current, [key]: value }))} />)}
        <Section title="Business Hours" />
        <View style={styles.row}>
          {[["openingTime", "Opening Time *", "08:00"], ["closingTime", "Closing Time *", "18:00"]].map(([key, label, initialValue]) =>
            <View key={key} style={styles.grow}><PickerField label={label} mode="time" value={values[key] || ""} initialValue={initialValue}
              onChange={value => setValues(current => ({ ...current, [key]: value }))} /></View>)}
        </View>
        <Section title="Shop Address" />
        <AddressFields values={values} setValues={setValues} />
      </Card>
    </View>
  </Screen>;
}
export function ServicesDesign() {
  const owned = useOwnedShop();
  const detail = useShop(owned.data?.id || 0);
  const shop = detail.data || owned.data;
  const [dialog, setDialog] = useState<"service" | "price" | null>(null);
  const [editing, setEditing] = useState<Service | KiloPrice | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [color, setColor] = useState("#98D8BF");
  const [busy, setBusy] = useState(false);
  const cache = useQueryClient();
  function open(kind: "service" | "price", item?: Service | KiloPrice) {
    setDialog(kind);
    setEditing(item || null);
    setValues(
      kind === "service"
        ? {
          serviceName: item && "serviceName" in item ? item.serviceName : "",
          price: item && "price" in item ? String(item.price) : "",
        }
        : {
          minKilo: item && "minKilo" in item ? String(item.minKilo) : "",
          maxKilo: item && "maxKilo" in item ? String(item.maxKilo) : "",
          pricePerKilo:
            item && "pricePerKilo" in item ? String(item.pricePerKilo) : "",
        },
    );
    setColor(item && "color" in item ? item.color || "#98D8BF" : "#98D8BF");
  }
  async function save() {
    if (!shop) return;
    if (editing)
      return unavailable(
        dialog === "service" ? "Edit service" : "Edit price range",
      );
    if (
      Object.values(values).some((value) => !value.trim()) ||
      Object.entries(values).some(
        ([key, value]) =>
          key !== "serviceName" &&
          (!Number.isFinite(Number(value)) || Number(value) < 0),
      )
    )
      return Alert.alert(
        "Required fields",
        "Please enter valid names and numbers.",
      );
    if (dialog === "price" && Number(values.maxKilo) <= Number(values.minKilo))
      return Alert.alert(
        "Price Range",
        "Maximum kilo must be greater than minimum kilo",
      );
    setBusy(true);
    try {
      await api.post(
        `/shops/${shop.id}/${dialog === "service" ? "services" : "kilo-prices"}`,
        dialog === "service"
          ? {
            serviceName: values.serviceName,
            price: Number(values.price),
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
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      title="SERVICES"
      back={false}
      right={
        <Pressable
          accessibilityLabel="Add service"
          onPress={() => open("service")}
        >
          <Plus size={24} color={palette.navy} />
        </Pressable>
      }
    >
      <View style={styles.stack}>
        <QueryState
          loading={owned.isLoading || detail.isLoading}
          error={owned.error || detail.error}
          retry={() => {
            owned.refetch();
            detail.refetch();
          }}
        />
        <Section title="YOUR SERVICES" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {shop?.services?.map((service) => (
            <Pressable
              key={service.id}
              onPress={() => open("service", service)}
              style={{
                minWidth: 140,
                flexGrow: 1,
                padding: 18,
                borderRadius: 12,
                backgroundColor:
                  service.color?.replace("0xFF", "#") || "#98D8BF",
                gap: 8,
              }}
            >
              <Txt style={{ fontWeight: "700", color: palette.navy }}>
                {service.serviceName}
              </Txt>
              <Txt>{money(service.price)}</Txt>
              <View style={styles.between}>
                <Pencil size={16} color={palette.navy} />
                <Pressable
                  accessibilityLabel={`Delete ${service.serviceName}`}
                  onPress={() =>
                    Alert.alert(
                      "Delete Service",
                      "Are you sure you want to delete this service?",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Delete",
                          style: "destructive",
                          onPress: () => unavailable("Delete service"),
                        },
                      ],
                    )
                  }
                >
                  <Trash2 size={16} color={palette.navy} />
                </Pressable>
              </View>
            </Pressable>
          ))}
        </View>
        {!shop?.services?.length && (
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
            <Pressable key={range.id} onPress={() => open("price", range)}>
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
            outline
            color={palette.navy}
            onPress={() => open("price")}
          />
        </Card>
      </View>
      <Modal
        visible={!!dialog}
        transparent
        animationType="fade"
        onRequestClose={() => setDialog(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#00000070",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Card style={{ width: "100%", maxWidth: 400, padding: 24 }}>
            <Txt style={styles.heading}>
              {editing ? "Edit" : "Add"}{" "}
              {dialog === "service" ? "Service" : "Price Range"}
            </Txt>
            {dialog === "service" ? (
              <>
                <Field
                  label="Service Name"
                  value={values.serviceName}
                  onChangeText={(serviceName) =>
                    setValues({ ...values, serviceName })
                  }
                />
                <Field
                  label="Service Price"
                  value={values.price}
                  keyboardType="decimal-pad"
                  onChangeText={(price) => setValues({ ...values, price })}
                />
                <Txt>Select Color:</Txt>
                <View style={styles.row}>
                  {["#98D8BF", "#64B5F6", "#BA68C8", "#FFB74D"].map((value) => (
                    <Pressable
                      key={value}
                      accessibilityLabel={`Select ${value}`}
                      onPress={() => setColor(value)}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: value,
                        borderWidth: 3,
                        borderColor:
                          color === value ? palette.navy : "transparent",
                      }}
                    />
                  ))}
                </View>
              </>
            ) : (
              [
                { key: "minKilo", label: "Minimum Kilo" },
                { key: "maxKilo", label: "Maximum Kilo" },
                { key: "pricePerKilo", label: "Price per Kilo" },
              ].map((field) => (
                <Field
                  key={field.key}
                  label={field.label}
                  keyboardType="decimal-pad"
                  value={values[field.key]}
                  onChangeText={(v) => setValues({ ...values, [field.key]: v })}
                />
              ))
            )}
            <View style={styles.row}>
              <Button
                title="Cancel"
                outline
                color={palette.navy}
                onPress={() => setDialog(null)}
                style={styles.grow}
              />
              <Button
                title={editing ? "Save" : "Add"}
                busy={busy}
                color={palette.navy}
                onPress={save}
                style={styles.grow}
              />
            </View>
            {editing && dialog === "price" && (
              <Button
                title="Delete Price Range"
                outline
                color={palette.danger}
                onPress={() => unavailable("Delete price range")}
              />
            )}
          </Card>
        </View>
      </Modal>
    </Screen>
  );
}
