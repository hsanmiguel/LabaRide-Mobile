import { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import {
  CalendarDays,
  CheckCircle2,
  History,
  Minus,
  Plus,
  Pencil,
  Truck,
} from "lucide-react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";
import {
  Asset,
  Button,
  Card,
  Choice,
  Empty,
  Field,
  MenuRow,
  PriceRow,
  Screen,
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
  go,
  replaceFlow,
  unavailable,
  useOrders,
  useProfile,
  type Order,
} from "./data";
import { clothingNames, householdNames, useLaundryDraft } from "./store";
import { QueryState } from "./UserScreens";

export function draftTotals() {
  const d = useLaundryDraft.getState();
  const kilos = Number(d.kilos) || 1;
  const range = d.shop?.kiloPrices?.find(
    (r) => kilos >= Number(r.minKilo) && kilos <= Number(r.maxKilo),
  );
  const subtotal = kilos * Number(range?.pricePerKilo || d.service?.price || 0);
  // Match the fixed delivery charge in Flutter's ordershopsystem.dart.
  const deliveryFee = d.deliveryType === "Deliver" ? 30 : 0;
  return { subtotal, deliveryFee, discount: 0, total: subtotal + deliveryFee };
}
export function Totals({ order }: { order?: Order }) {
  useLaundryDraft();
  const totals = draftTotals();
  return (
    <View>
      <PriceRow
        label="Subtotal"
        value={money(order?.subtotal ?? totals.subtotal)}
      />
      <PriceRow
        label="Delivery Fee"
        value={money(order?.deliveryFee ?? totals.deliveryFee)}
      />
      <PriceRow
        label="Voucher"
        value={`−${money(order?.voucherDiscount ?? totals.discount)}`}
      />
      <View style={styles.divider} />
      <PriceRow
        label="Total"
        value={money(order?.totalAmount ?? totals.total)}
        total
      />
    </View>
  );
}
export function LaundryCountDesign() {
  const draft = useLaundryDraft();
  const clothing = draft.shop?.clothingTypes?.length
    ? draft.shop.clothingTypes.map((i) => i.typeName || "Clothing")
    : clothingNames;
  const household = draft.shop?.householdItems?.length
    ? draft.shop.householdItems.map((i) => i.itemName || "Household item")
    : householdNames;
  return (
    <Screen
      title="Laundries"
      footer={
        <Button
          title="Confirm"
          color={palette.navy}
          onPress={() => router.back()}
        />
      }
    >
      <View style={styles.stack}>
        {[
          { title: "Types of Clothing", names: clothing },
          { title: "Household Items", names: household },
        ].map((group) => (
          <View key={group.title}>
            <Section title={group.title} />
            {group.names.map((name) => (
              <View
                key={name}
                style={[styles.between, { paddingVertical: 10 }]}
              >
                <Txt style={{ color: palette.navy }}>{name}</Txt>
                <View style={styles.row}>
                  <Pressable
                    accessibilityLabel={`Remove ${name}`}
                    onPress={() =>
                      draft.set({
                        counts: {
                          ...draft.counts,
                          [name]: Math.max(0, (draft.counts[name] || 0) - 1),
                        },
                      })
                    }
                  >
                    <Minus color={palette.navy} size={22} />
                  </Pressable>
                  <Txt
                    style={{
                      fontWeight: "600",
                      minWidth: 20,
                      textAlign: "center",
                    }}
                  >
                    {draft.counts[name] || 0}
                  </Txt>
                  <Pressable
                    accessibilityLabel={`Add ${name}`}
                    onPress={() =>
                      draft.set({
                        counts: {
                          ...draft.counts,
                          [name]: (draft.counts[name] || 0) + 1,
                        },
                      })
                    }
                  >
                    <Plus color={palette.navy} size={22} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ))}
      </View>
    </Screen>
  );
}
export function OrderSummaryDesign() {
  const draft = useLaundryDraft();
  const user = useAuthStore((state) => state.user);
  const totals = draftTotals();
  if (!draft.service)
    return (
      <Screen title="Order Summary">
        <Empty
          title="Your basket is empty"
          action="Explore shops"
          onPress={() => router.replace("/(user)/home")}
        />
      </Screen>
    );
  return (
    <Screen
      title="Order Summary"
      background={palette.surface}
      footer={
        <Button
          title="Proceed to checkout"
          color={palette.navy}
          onPress={() =>
            user
              ? go("checkout")
              : Alert.alert(
                  "Login Required",
                  "Please log in to place your order.",
                  [
                    { text: "Cancel" },
                    {
                      text: "Log In",
                      onPress: () => router.push("/(auth)/login"),
                    },
                  ],
                )
          }
        />
      }
    >
      <View style={styles.stack}>
        <Card>
          <View style={styles.between}>
            <View style={styles.row}>
              <Asset name="basket.png" tint={palette.navy} />
              <Txt style={styles.heading}>Order Summary</Txt>
            </View>
            <Txt style={{ fontWeight: "600", color: palette.navy }}>
              {money(totals.subtotal)}
            </Txt>
          </View>
        </Card>
        <Card>
          <View style={styles.between}>
            <View style={styles.row}>
              <Asset name="washingmachine.png" tint={palette.navy} />
              <Txt style={styles.heading}>Services</Txt>
            </View>
            <Pressable
              accessibilityLabel="Edit laundries"
              onPress={() => go("laundries")}
            >
              <Pencil size={20} color={palette.navy} />
            </Pressable>
          </View>
          <Txt style={{ color: palette.navy, fontWeight: "500" }}>
            {draft.service.serviceName}
          </Txt>
          {Object.entries(draft.counts)
            .filter(([, count]) => count > 0)
            .map(([name, count]) => (
              <PriceRow key={name} label={name} value={String(count)} />
            ))}
          {!Object.values(draft.counts).some((count) => count > 0) && (
            <MenuRow
              title="Add laundry items"
              onPress={() => go("laundries")}
            />
          )}
        </Card>
        <Card>
          <Txt style={styles.heading}>Note to Laundry Shop</Txt>
          <Field
            placeholder="Add your note here"
            multiline
            value={draft.notes}
            onChangeText={(notes) => draft.set({ notes })}
          />
        </Card>
        <Totals />
      </View>
    </Screen>
  );
}
export function CheckoutDesign() {
  const draft = useLaundryDraft();
  const profile = useProfile();
  const [busy, setBusy] = useState(false);
  const cache = useQueryClient();
  const deliveryAddress = draft.address || profile.data;
  const totals = draftTotals();
  async function submit() {
    if (!draft.shop || !draft.service) return;
    if (!(Number(draft.kilos) > 0))
      return Alert.alert("Laundry Weight", "Please enter valid weight");
    if (!draft.schedule || new Date(draft.schedule).getTime() <= Date.now())
      return Alert.alert(
        "Delivery Schedule",
        "Please select a future delivery schedule",
      );
    if (
      draft.deliveryType === "Deliver" &&
      (!deliveryAddress?.street ||
        !deliveryAddress.barangay ||
        !deliveryAddress.zone)
    )
      return Alert.alert(
        "Delivery Address",
        "Please complete your delivery address.",
      );
    setBusy(true);
    try {
      const order = await api.post<Order>("/transactions", {
        shopId: draft.shop.id,
        serviceName: draft.service.serviceName,
        kiloAmount: Number(draft.kilos),
        subtotal: totals.subtotal,
        deliveryFee: totals.deliveryFee,
        voucherDiscount: 0,
        totalAmount: totals.total,
        deliveryType: draft.deliveryType,
        zone: deliveryAddress?.zone || "",
        street: deliveryAddress?.street || "",
        barangay: deliveryAddress?.barangay || "",
        building: deliveryAddress?.building || "",
        scheduledDate: draft.schedule,
        scheduledTime: draft.schedule,
        paymentMethod: draft.paymentMethod,
        notes: draft.notes,
        items: Object.entries(draft.counts)
          .filter(([, count]) => count > 0)
          .map(([itemName, quantity]) => ({ itemName, quantity })),
      });
      await cache.invalidateQueries({ queryKey: ["user-orders"] });
      replaceFlow("order-complete", { id: String(order.id) });
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }
  if (!draft.service)
    return (
      <Screen title="Checkout">
        <Empty title="Your basket is empty" />
      </Screen>
    );
  return (
    <Screen
      title="Checkout"
      background={palette.surface}
      footer={
        <View style={styles.between}>
          <View>
            <Txt style={styles.muted}>Total (incl. vat)</Txt>
            <Txt style={styles.heading}>{money(totals.total)}</Txt>
          </View>
          <Button
            title="Place Order"
            color={palette.navy}
            onPress={submit}
            busy={busy}
          />
        </View>
      }
    >
      <View style={styles.stack}>
        <Card>
          <MenuRow
            title={
              draft.deliveryType === "Pickup"
                ? "Pickup from shop"
                : "Delivery Address"
            }
            detail={
              draft.deliveryType === "Pickup"
                ? address(draft.shop)
                : address(deliveryAddress) || "Choose your delivery address"
            }
            asset="locationblue.png"
            onPress={() => go("add-location", { checkout: "true" })}
          />
        </Card>
        <Card>
          <Section title="Laundry Weight" />
          <Field
            placeholder="Enter weight in kilos"
            keyboardType="decimal-pad"
            value={draft.kilos}
            onChangeText={(kilos) => draft.set({ kilos })}
          />
        </Card>
        <Card>
          <View style={styles.between}>
            <Txt style={styles.heading}>Order Summary</Txt>
            <Pressable onPress={() => go("laundries")}>
              <Pencil size={20} color={palette.navy} />
            </Pressable>
          </View>
          <Txt style={{ color: palette.navy }}>{draft.service.serviceName}</Txt>
          {Object.entries(draft.counts)
            .filter(([, n]) => n > 0)
            .map(([name, n]) => (
              <PriceRow key={name} label={`${name} x${n}`} value="" />
            ))}
          <Totals />
        </Card>
        <MenuRow
          title="Payment Method"
          detail={draft.paymentMethod}
          asset="bluepeso.png"
          onPress={() => go("payment-method")}
        />
        <MenuRow
          title="Delivery Schedule"
          detail={
            draft.schedule
              ? new Date(draft.schedule).toLocaleString()
              : "Select Delivery Schedule"
          }
          asset="Time.png"
          onPress={() => go("delivery-schedule")}
        />
        <MenuRow
          title="Voucher"
          detail="Your Vouchers"
          asset="bluegift.png"
          onPress={() => go("vouchers")}
        />
      </View>
    </Screen>
  );
}
export function ScheduleDesign() {
  const draft = useLaundryDraft();
  const initial = draft.schedule
    ? new Date(draft.schedule)
    : new Date(Date.now() + 86400000);
  const [month, setMonth] = useState(
    new Date(initial.getFullYear(), initial.getMonth(), 1),
  );
  const [selected, setSelected] = useState(initial.getDate());
  const [hour, setHour] = useState(String(initial.getHours() % 12 || 12));
  const [minute, setMinute] = useState("00");
  const [period, setPeriod] = useState(initial.getHours() >= 12 ? "PM" : "AM");
  const dayCount = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const offset = month.getDay();
  function confirm() {
    const h = Number(hour);
    const m = Number(minute);
    if (
      !Number.isInteger(h) ||
      h < 1 ||
      h > 12 ||
      !Number.isInteger(m) ||
      m < 0 ||
      m > 59
    )
      return Alert.alert("Delivery Schedule", "Enter a valid time.");
    const date = new Date(
      month.getFullYear(),
      month.getMonth(),
      selected,
      (h % 12) + (period === "PM" ? 12 : 0),
      m,
    );
    if (date.getTime() <= Date.now() || date.getHours() < 4)
      return Alert.alert(
        "Delivery Schedule",
        "Choose a future time between 4 AM and 11 PM.",
      );
    draft.set({ schedule: date.toISOString() });
    router.back();
  }
  return (
    <Screen
      title="Select Delivery Schedule"
      footer={
        <Button
          title="Confirm Schedule"
          color={palette.navy}
          onPress={confirm}
        />
      }
    >
      <View style={styles.stack}>
        <CalendarDays size={40} color={palette.navy} />
        <View style={styles.row}>
          <View style={styles.grow}>
            <Field
              label="Hour"
              value={hour}
              onChangeText={setHour}
              keyboardType="number-pad"
              maxLength={2}
              style={{ fontSize: 30, textAlign: "center" }}
            />
          </View>
          <Txt style={{ fontSize: 30 }}>:</Txt>
          <View style={styles.grow}>
            <Field
              label="Minute"
              value={minute}
              onChangeText={setMinute}
              keyboardType="number-pad"
              maxLength={2}
              style={{ fontSize: 30, textAlign: "center" }}
            />
          </View>
        </View>
        <TabsRow
          items={["AM", "PM"]}
          value={period}
          onChange={setPeriod}
          color={palette.navy}
        />
        <Card>
          <View style={styles.between}>
            <Pressable
              accessibilityLabel="Previous month"
              onPress={() => {
                setMonth(
                  new Date(month.getFullYear(), month.getMonth() - 1, 1),
                );
                setSelected(1);
              }}
            >
              <Txt style={styles.heading}>‹</Txt>
            </Pressable>
            <Txt style={styles.heading}>
              {month.toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              })}
            </Txt>
            <Pressable
              accessibilityLabel="Next month"
              onPress={() => {
                setMonth(
                  new Date(month.getFullYear(), month.getMonth() + 1, 1),
                );
                setSelected(1);
              }}
            >
              <Txt style={styles.heading}>›</Txt>
            </Pressable>
          </View>
          <View style={{ flexDirection: "row" }}>
            {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
              <Txt
                key={i}
                style={{
                  width: `${100 / 7}%`,
                  textAlign: "center",
                  color: palette.muted,
                }}
              >
                {day}
              </Txt>
            ))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {Array.from({ length: offset + dayCount }, (_, i) => (
              <Pressable
                key={i}
                disabled={i < offset}
                onPress={() => setSelected(i - offset + 1)}
                style={{
                  width: `${100 / 7}%`,
                  height: 44,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor:
                    selected === i - offset + 1 ? palette.navy : "white",
                  borderRadius: 22,
                }}
              >
                <Txt
                  style={{
                    color: selected === i - offset + 1 ? "white" : palette.navy,
                  }}
                >
                  {i >= offset ? i - offset + 1 : ""}
                </Txt>
              </Pressable>
            ))}
          </View>
        </Card>
        <Txt style={styles.muted}>
          Delivery Date:{" "}
          {new Date(
            month.getFullYear(),
            month.getMonth(),
            selected,
          ).toLocaleDateString()}
        </Txt>
      </View>
    </Screen>
  );
}
export function PaymentDesign() {
  const draft = useLaundryDraft();
  return (
    <Screen
      title="Payment Method"
      footer={
        <Button
          title="Confirm"
          color={palette.navy}
          onPress={() => router.back()}
        />
      }
    >
      <Card>
        <Choice
          label="Cash on Delivery"
          selected={draft.paymentMethod === "Cash on Delivery"}
          onPress={() => draft.set({ paymentMethod: "Cash on Delivery" })}
        />
      </Card>
    </Screen>
  );
}
export function VouchersDesign() {
  return (
    <Screen title="Your Vouchers" dark background="#003366">
      <View style={{ gap: 20, paddingHorizontal: 16 }}>
        {[
          {
            title: "− ₱150",
            date: "April 4 – 7, 2025",
            gift: "bluegift.png" as const,
          },
          {
            title: "50% OFF",
            date: "April 4 – 10, 2025",
            gift: "pinkgift.png" as const,
          },
          {
            title: "35% Shipping",
            date: "April 4, 2025",
            gift: "yellowgift.png" as const,
          },
        ].map((voucher) => (
          <Pressable
            key={voucher.title}
            onPress={() =>
              Alert.alert("Voucher expired", "This voucher is no longer valid.")
            }
          >
            <View
              style={{
                height: 120,
                borderRadius: 20,
                backgroundColor: "white",
                padding: 20,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <View style={{ gap: 12 }}>
                <View style={[styles.row, { gap: 8 }]}>
                  <Asset name="Time.png" size={20} />
                  <Txt style={{ fontSize: 12, color: palette.muted }}>
                    {voucher.date}
                  </Txt>
                </View>
                <Txt style={{ fontSize: 24, fontWeight: "700" }}>
                  {voucher.title}
                </Txt>
                <Txt style={{ color: palette.muted, fontSize: 11 }}>
                  Expired
                </Txt>
              </View>
              <Asset name={voucher.gift} size={50} />
              <View
                style={{
                  position: "absolute",
                  left: -10,
                  top: 50,
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: "#003366",
                }}
              />
              <View
                style={{
                  position: "absolute",
                  right: -10,
                  top: 50,
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: "#003366",
                }}
              />
            </View>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
export function StatusBadge({ status }: { status: Order["status"] }) {
  const colors = {
    Pending: "#FFA000",
    Processing: "#1976D2",
    Completed: "#388E3C",
    Cancelled: "#D32F2F",
  };
  return (
    <View
      style={{
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 5,
        backgroundColor: `${colors[status]}18`,
      }}
    >
      <Txt style={{ color: colors[status], fontSize: 12, fontWeight: "600" }}>
        {status}
      </Txt>
    </View>
  );
}
export function OrderCard({
  order,
  shopMode = false,
}: {
  order: Order;
  shopMode?: boolean;
}) {
  return (
    <Card>
      <Txt style={{ color: palette.muted, fontSize: 12 }}>
        {new Date(order.createdAt).toLocaleString()}
      </Txt>
      <View style={styles.between}>
        <Txt style={{ fontWeight: "600" }}>Order ID: #{order.id}</Txt>
        <StatusBadge status={order.status} />
      </View>
      <Txt style={styles.muted}>
        {shopMode ? order.userName : order.shop?.shopName || "Laundry Shop"}
      </Txt>
      <Txt style={styles.muted}>Service: {order.serviceName}</Txt>
      <View style={styles.between}>
        <View>
          <Txt style={{ color: palette.muted, fontSize: 12 }}>Amount Paid</Txt>
          <Txt style={{ fontWeight: "600", marginTop: 4 }}>
            {money(order.totalAmount)}
          </Txt>
        </View>
        <View>
          <Txt style={{ color: palette.muted, fontSize: 12 }}>
            Delivery Charges
          </Txt>
          <Txt style={{ fontWeight: "600", marginTop: 4 }}>
            {money(order.deliveryFee)}
          </Txt>
        </View>
        <Button
          title="Details"
          outline
          color={palette.navy}
          onPress={() =>
            shopMode
              ? router.push({
                  pathname: "/(shop)/orders/[id]",
                  params: { id: String(order.id) },
                })
              : go("transaction-details", { id: String(order.id) })
          }
        />
      </View>
    </Card>
  );
}
export function ActivitiesDesign({
  history = false,
  past = false,
}: {
  history?: boolean;
  past?: boolean;
}) {
  const orders = useOrders();
  const user = useAuthStore((state) => state.user);
  const [tab, setTab] = useState(past ? "Past Order" : "Active Order");
  const filtered = (orders.data || []).filter(
    (order) =>
      !history ||
      (tab === "Past Order"
        ? ["Completed", "Cancelled"].includes(order.status)
        : ["Pending", "Processing"].includes(order.status)),
  );
  return (
    <Screen
      title={history ? "History" : "Activity"}
      dark={!history}
      background={history ? palette.surface : "#1E54AB"}
      back={history}
      right={
        !history && (
          <Pressable
            onPress={() => go("history")}
            style={{ backgroundColor: "white", padding: 10, borderRadius: 12 }}
          >
            <View style={[styles.row, { gap: 6 }]}>
              <History size={16} color="#4D3E8C" />
              <Txt style={{ fontSize: 12, color: "#4D3E8C" }}>History</Txt>
            </View>
          </Pressable>
        )
      }
    >
      <View style={styles.stack}>
        {!user ? (
          <Card>
            <Empty
              title="Login Required"
              message="Please login to view your activities"
              action="Login"
              onPress={() => router.push("/(auth)/login")}
            />
          </Card>
        ) : (
          <>
            {history ? (
              <TabsRow
                items={["Active Order", "Past Order"]}
                value={tab}
                onChange={setTab}
              />
            ) : (
              <Section title="Recent" light />
            )}
            <QueryState
              loading={orders.isLoading}
              error={orders.error}
              retry={() => orders.refetch()}
            />
            {filtered.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
            {!orders.isLoading && !orders.error && !filtered.length && (
              <Card>
                <Empty
                  title={
                    history
                      ? `No ${tab === "Past Order" ? "past" : "active"} orders`
                      : "No recent transactions"
                  }
                />
              </Card>
            )}
          </>
        )}
      </View>
    </Screen>
  );
}
export function OrderDetailsDesign({
  id,
  delivered = false,
  full = false,
}: {
  id: number;
  delivered?: boolean;
  full?: boolean;
}) {
  const orders = useOrders();
  const order = orders.data?.find((o) => o.id === id);
  if (!order)
    return (
      <Screen title="Order Details">
        <QueryState
          loading={orders.isLoading}
          error={orders.error}
          retry={() => orders.refetch()}
        />
        {!orders.isLoading && !orders.error && (
          <Empty title="No order details found" />
        )}
      </Screen>
    );
  return (
    <Screen
      title={
        delivered ? "Order Delivered" : full ? "Full Details" : "Order Details"
      }
      background={palette.surface}
      footer={
        order.status === "Pending" ? (
          <Button
            title="Cancel Order"
            outline
            color={palette.navy}
            onPress={() => go("cancel-order", { id: String(id) })}
          />
        ) : order.status === "Completed" ? (
          <Button
            title="Order Again"
            color={palette.navy}
            onPress={() =>
              router.push({
                pathname: "/(user)/order/[shopId]",
                params: { shopId: String(order.shopId) },
              })
            }
          />
        ) : undefined
      }
    >
      <View style={styles.stack}>
        <Card>
          <View style={styles.between}>
            <Txt style={styles.heading}>
              {delivered ? "Order Complete" : "Thank you for your order!"}
            </Txt>
            <StatusBadge status={order.status} />
          </View>
          <Txt style={styles.muted}>
            {delivered
              ? "Thank you for your order in our laundry shop! We hope to see you and serve you again."
              : `Order #${order.id}`}
          </Txt>
          {!full && (
            <View style={styles.row}>
              <CheckCircle2 size={24} color={palette.blue} />
              <Txt style={styles.muted}>
                {order.status === "Pending"
                  ? "Waiting for shop confirmation"
                  : order.status === "Processing"
                    ? "Your laundry is in progress"
                    : order.status === "Completed"
                      ? "Your laundry is ready"
                      : "Order cancelled"}
              </Txt>
            </View>
          )}
        </Card>
        <Card>
          <Section title={full ? "Shipping Information" : "Order Details"} />
          <MenuRow
            title={order.userName}
            detail={address(order)}
            asset="delivery.png"
          />
          <MenuRow
            title={order.shop?.shopName || "Laundry Shop"}
            detail={order.shop?.address}
            asset="shop.png"
          />
          <PriceRow label="Order ID:" value={`#${order.id}`} />
          <PriceRow label="Payment Method" value={order.paymentMethod} />
          <PriceRow
            label="Delivery Schedule"
            value={new Date(order.scheduledDate).toLocaleDateString()}
          />
        </Card>
        <Card>
          <View style={styles.row}>
            <Asset name="washonly.png" size={40} />
            <View>
              <Txt style={styles.heading}>{order.serviceName}</Txt>
              <Txt style={styles.muted}>
                {order.kiloAmount} kg · {order.deliveryType}
              </Txt>
            </View>
          </View>
          <Section title="Items" />
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
          {order.notes && <Txt style={styles.muted}>{order.notes}</Txt>}
        </Card>
        <Card>
          <Totals order={order} />
        </Card>
        {delivered && (
          <Button
            title="Tip and Rate"
            outline
            color={palette.navy}
            onPress={() => unavailable("Tip and Rate")}
          />
        )}
      </View>
    </Screen>
  );
}
export function CancelOrderDesign({ id }: { id: number }) {
  const orders = useOrders();
  const order = orders.data?.find((o) => o.id === id);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const cache = useQueryClient();
  async function cancel() {
    if (!order || order.status !== "Pending")
      return Alert.alert(
        "Cancel Order",
        "You can cancel an order before it is accepted",
      );
    setBusy(true);
    try {
      await api.put(`/transactions/${id}/cancel`, { reason });
      await cache.invalidateQueries({ queryKey: ["user-orders"] });
      replaceFlow("order-cancelled");
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      title="Cancel Order"
      footer={
        <Button
          title="Confirm"
          color={palette.navy}
          disabled={!reason || !order || order.status !== "Pending"}
          busy={busy}
          onPress={() =>
            Alert.alert(
              "Cancel Order",
              "Are you sure you want to cancel your order?",
              [
                { text: "No", style: "cancel" },
                { text: "Yes", style: "destructive", onPress: cancel },
              ],
            )
          }
        />
      }
    >
      <View style={styles.stack}>
        <Card>
          <PriceRow label="Order number:" value={`#${id}`} />
          <PriceRow label="Shop name:" value={order?.shop?.shopName || "—"} />
        </Card>
        <Txt style={[styles.heading, { marginVertical: 12 }]}>
          You can cancel an order before it is accepted
        </Txt>
        <Txt style={styles.heading}>Why do you want to cancel your order?</Txt>
        {[
          "Accidentally placed order",
          "Voucher wasn't applied",
          "I changed my mind",
          "The order is duplicated",
        ].map((value) => (
          <Choice
            key={value}
            label={value}
            selected={reason === value}
            onPress={() => setReason(value)}
          />
        ))}
      </View>
    </Screen>
  );
}
