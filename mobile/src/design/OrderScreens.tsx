import { useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, Modal, Pressable, ScrollView, View } from "react-native";
import {
  CalendarDays,
  ChevronUp,
  ChevronDown,
  Clock,
  CheckCircle2,
  History,
  Minus,
  Plus,
  Pencil,
  Truck,
} from "lucide-react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  servicePriceLabel,
  palette,
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
  useProfile,
  type Order,
  type Shop,
  type Profile,
} from "./data";
import { addressError, addressPayload, addressValues } from "./address";
import { AddressFields, DeliveryDetails, FormError } from "./AddressFields";
import { message } from "./data";
import { clothingNames, householdNames, useLaundryDraft } from "./store";
import { orderPricing } from "./order-pricing";
import { scheduleDayAvailable, validFutureSchedule, deliveryLeadMinutes, deliveryScheduleError, earliestDeliveryTime } from "./schedule";
import { QueryState } from "./UserScreens";

export function draftTotals() {
  const d = useLaundryDraft.getState();
  return orderPricing(d.kilos, d.service, d.shop, d.deliveryType, d.serviceIds);
}
export function Totals({ order }: { order?: Order }) {
  useLaundryDraft();
  const totals = draftTotals();
  return (
    <View>
      <PriceRow
        label="Subtotal"
        value={order ? money(order.subtotal) : totals.subtotal === null ? "Enter laundry weight" : money(totals.subtotal)}
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
        value={order ? money(order.totalAmount) : totals.total === null ? "Enter laundry weight" : money(totals.total)}
        total
      />
    </View>
  );
}
export function EmbeddedOrderPanel({ children, footer }: { children: ReactNode; footer?: ReactNode; title?: string; background?: string }) {
  return <View style={{ gap: 16 }}>{children}{footer}</View>;
}

export function LaundryCountDesign({ embedded = false, onDone }: { embedded?: boolean; onDone?: () => void } = {}) {
  const draft = useLaundryDraft();
  const clothing = draft.shop?.clothingTypes?.length
    ? draft.shop.clothingTypes.map((i) => i.typeName || "Clothing")
    : clothingNames;
  const household = draft.shop?.householdItems?.length
    ? draft.shop.householdItems.map((i) => i.itemName || "Household item")
    : householdNames;
  const Container = embedded ? EmbeddedOrderPanel : Screen;
  return (
    <Container
      title="Laundries"
      footer={
        <Button
          title="Confirm"
          color={palette.navy}
          onPress={() => onDone ? onDone() : router.back()}
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
                <Txt style={{ color: palette.navy, flex: 1 }}>{name}</Txt>
                <View style={styles.row}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${name}`}
                    disabled={!draft.counts[name]}
                    style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: palette.surface }}
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
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${name}`}
                    style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: palette.surface }}
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
    </Container>
  );
}
export function OrderSummaryDesign() {
  return <CheckoutDesign />;
}
export function CheckoutDesign() {
  const { replaceFlow } = useFlowNavigation();
  const draft = useLaundryDraft();
  const user = useAuthStore(state => state.user);
  const profile = useProfile();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [dialog, setDialog] = useState<"items" | "address" | "schedule" | null>(null);
  const [addressForm, setAddressForm] = useState<Record<string, string>>({});
  const [addressFormError, setAddressFormError] = useState<string | null>(null);
  const cache = useQueryClient();
  const deliveryAddress = draft.deliveryType === "Pickup" ? draft.shop : draft.address || profile.data;
  const totals = draftTotals();
  const savedAddresses = useQuery({
    queryKey: ["saved-addresses", user?.id], enabled: !!user,
    queryFn: async () => {
      const raw = await AsyncStorage.getItem(`labaride-addresses:${user!.id}`);
      return raw ? JSON.parse(raw) as Partial<Profile>[] : [];
    },
  });
  function editAddress() {
    setAddressForm(addressValues(draft.address || profile.data));
    setAddressFormError(null);
    setDialog("address");
  }
  function saveAddress() {
    const validation = addressError(addressForm);
    if (validation) { setAddressFormError(validation); return; }
    draft.set({ address: addressPayload(addressForm) });
    setDialog(null);
  }
  async function submit() {
    if (!draft.shop || !draft.service) return;
    if (!user) { router.push("/(auth)/login"); return; }
    if (submitting.current || busy) return;
    if (dialog) { setError("Finish editing your order details before placing the order."); return; }
    const locationError = addressError(deliveryAddress);
    const scheduleError = deliveryScheduleError(draft.schedule, draft.service.serviceName, draft.deliveryType);
    const validation = totals.kilos === null ? "Enter a weight above 0 kg with up to two decimal places." :
      totals.pricingError ? totals.pricingError :
      scheduleError ? scheduleError :
        locationError && draft.deliveryType === "Pickup" ? "The shop address is incomplete. Ask the shop owner to update Shop Details before booking pickup." : locationError;
    if (validation) { setError(validation); return; }
    if (totals.kilos === null || totals.subtotal === null || totals.total === null) return;
    setError(null);
    submitting.current = true;
    setBusy(true);
    try {
      const order = await api.post<Order>("/transactions", {
        shopId: draft.shop.id,
        serviceName: draft.service.serviceName,
        serviceIds: draft.serviceIds,
        kiloAmount: totals.kilos,
        subtotal: totals.subtotal,
        deliveryFee: totals.deliveryFee,
        voucherDiscount: 0,
        totalAmount: totals.total,
        deliveryType: draft.deliveryType,
        ...addressPayload(deliveryAddress!),
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
      if ((error as { error?: { code?: string } })?.error?.code === "PRICE_CHANGED" && draft.shop) {
        try {
          const refreshedShop = await api.get<Shop>(`/shops/${draft.shop.id}`);
          const selected = draft.serviceIds.map((id) => refreshedShop.services?.find((service) => service.id === id));
          if (selected.length && selected.every((service) => !!service)) {
            draft.set({
              shop: refreshedShop,
              service: {
                ...selected[0]!,
                serviceName: selected.map((service) => service!.serviceName).join(", "),
                price: selected.reduce((sum, service) => sum + Number(service!.price), 0),
              },
            });
            setError("Shop prices changed. Review the updated total before placing your order.");
          } else {
            setError("A selected service is no longer available. Return to the shop and choose a service again.");
          }
        } catch (refreshError) {
          setError(message(refreshError));
        }
      } else {
        setError(message(error));
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  if (!draft.service)
    return (
      <Screen title="Order Summary">
        <Empty title="Your basket is empty" />
      </Screen>
    );
  return (
    <Screen
      title="Order Summary"
      background={palette.surface}
      footer={
        <View style={{ width: "100%", maxWidth: 760, alignSelf: "center" }}>
          <FormError error={error} />
          <View style={styles.between}>
            <View>
              <Txt style={styles.muted}>Total</Txt>
              <Txt style={styles.heading}>{totals.total === null ? "Enter weight" : money(totals.total)}</Txt>
            </View>
            <Button
              title={user ? "Place Order" : "Log In to Place Order"}
              color={palette.navy}
              onPress={submit}
              busy={busy}
              disabled={!!dialog}
            />
          </View>
        </View>
      }
    >
      <View style={[styles.stack, { width: "100%", maxWidth: 760, alignSelf: "center" }]}>
        <QueryState loading={profile.isLoading} error={profile.error} retry={() => profile.refetch()} />
        <Card>
          <Section title="Shop & Selected Services" />
          <Txt style={styles.heading}>{draft.shop?.shopName}</Txt>
          <Txt style={styles.muted}>{address(draft.shop)}</Txt>
          <PriceRow label="Customer" value={profile.data?.name || user?.name || "Log in to place your order"} />
          <PriceRow label="Contact Number" value={profile.data?.phone || "Not provided"} />
          {!!user?.email && <PriceRow label="Email" value={user.email} />}
          {(draft.shop?.services?.filter(item => draft.serviceIds.includes(item.id)) || []).map(item => (
            <View key={item.id} style={{ gap: 4, paddingVertical: 8 }}>
              <Txt style={{ color: palette.navy, fontWeight: "600" }}>{item.serviceName}</Txt>
              <Txt style={styles.muted}>{servicePriceLabel(item)}</Txt>
            </View>
          ))}
          {!draft.serviceIds.length && <Txt style={{ color: palette.navy }}>{draft.service.serviceName}: {servicePriceLabel(draft.service)}</Txt>}
        </Card>
        <Card>
          <Section title="Delivery or Pickup" />
          <View style={[styles.row, { flexWrap: "wrap" }]}>
            <Choice label="Delivery" selected={draft.deliveryType === "Deliver"} onPress={() => { draft.set({ deliveryType: "Deliver" }); setError(null); }} />
            <Choice label="Pickup from Shop" selected={draft.deliveryType === "Pickup"} onPress={() => { draft.set({ deliveryType: "Pickup" }); setError(null); }} />
          </View>
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
            onPress={draft.deliveryType === "Deliver" ? editAddress : undefined}
          />
          {deliveryAddress && <DeliveryDetails value={deliveryAddress} />}
        </Card>
        <Card>
          <Section title="Laundry Weight" />
          <Field
            placeholder="Enter weight in kilos"
            keyboardType="decimal-pad"
            suffix="kg"
            value={draft.kilos}
            onChangeText={(kilos) => draft.set({ kilos })}
          />
          {!!draft.kilos && <FormError error={totals.kilos === null ? "Enter a weight above 0 kg with up to two decimal places." : totals.pricingError} />}
          {totals.kilos !== null && totals.rate !== null && (
            <Txt style={styles.muted}>Shop rate: {money(totals.rate)} per kg</Txt>
          )}
          {totals.packageLoads.map((item, index) => (
            <Txt key={index} style={styles.muted}>
              {item.serviceName}: {money(item.price)} per load of up to {item.packageKilos} kg
              {item.loads !== null && !totals.pricingError ? ` · ${item.loads} ${item.loads === 1 ? "load" : "loads"}` : ""}
            </Txt>
          ))}
        </Card>
        <Card>
          <View style={[styles.between, { flexWrap: "wrap" }]}>
            <Txt style={styles.heading}>Laundry Items</Txt>
            <Button title="Add Types of Clothes" compact outline color={palette.navy}
              icon={<Pencil size={14} color={palette.navy} />} onPress={() => setDialog("items")} />
          </View>
          {Object.entries(draft.counts)
            .filter(([, n]) => n > 0)
            .map(([name, n]) => (
              <PriceRow key={name} label={`${name} x${n}`} value="" />
            ))}
          {!Object.values(draft.counts).some(count => count > 0) && <Txt style={styles.muted}>No clothing quantities added yet.</Txt>}
        </Card>
        <Card>
        <MenuRow
          title="Delivery Schedule"
          detail={
            draft.schedule
              ? new Date(draft.schedule).toLocaleString()
              : "Select Delivery Schedule"
          }
          asset="Time.png"
          onPress={() => setDialog(dialog === "schedule" ? null : "schedule")}
        />
        {dialog === "schedule" && <ScheduleDesign embedded onDone={() => setDialog(null)} />}
        </Card>
        <Card>
          <Section title="Note to Laundry Shop" />
          <Field label="Order Notes (optional)" placeholder="Special instructions for your laundry" multiline
            value={draft.notes} onChangeText={notes => draft.set({ notes })} />
        </Card>
        <Card>
          <Section title="Payment Method" />
          <Choice label="Cash on Delivery" selected={draft.paymentMethod === "Cash on Delivery"}
            onPress={() => draft.set({ paymentMethod: "Cash on Delivery" })} />
          <Section title="Fees & Total" />
          <Totals />
        </Card>
      </View>
      <Modal visible={dialog === "items" || dialog === "address"} transparent animationType="fade" onRequestClose={() => setDialog(null)}>
        {(dialog === "items" || dialog === "address") && <View style={{ flex: 1, backgroundColor: "#00000070", justifyContent: "center", alignItems: "center", padding: 20 }}>
          <Card style={{ width: "100%", maxWidth: 540, maxHeight: "90%", padding: 24 }}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 16 }}>
              <View style={[styles.between, { flexWrap: "wrap" }]}>
                <Txt style={styles.heading}>{dialog === "items" ? "Laundry Items" : "Delivery Address"}</Txt>
                <Button title="Close" compact outline color={palette.navy} onPress={() => setDialog(null)} />
              </View>
              {dialog === "items" ? <LaundryCountDesign embedded onDone={() => setDialog(null)} /> : <View>
                {profile.data && !addressError(profile.data) && <Button title="Use Primary Address" compact outline color={palette.navy}
                  onPress={() => { setAddressForm(addressValues(profile.data)); setAddressFormError(null); }} />}
                {savedAddresses.data?.map((item, index) => <MenuRow key={index} title={address(item)}
                  onPress={() => { setAddressForm(addressValues(item)); setAddressFormError(null); }} />)}
                <AddressFields values={addressForm} setValues={setAddressForm} />
                <FormError error={addressFormError} />
                <Button title="Use This Address" color={palette.navy} onPress={saveAddress} />
              </View>}
            </ScrollView>
          </Card>
        </View>}
      </Modal>
    </Screen>
  );
}
export function ScheduleDesign({ embedded = false, onDone }: { embedded?: boolean; onDone?: () => void } = {}) {
  const draft = useLaundryDraft();
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const leadMinutes = deliveryLeadMinutes(draft.service?.serviceName, draft.deliveryType);
  const earliestTime = earliestDeliveryTime(draft.service?.serviceName, draft.deliveryType, now.getTime());
  const initial = !deliveryScheduleError(draft.schedule, draft.service?.serviceName, draft.deliveryType)
    ? new Date(draft.schedule)
    : new Date(Date.now() + 86400000);
  const [month, setMonth] = useState(
    new Date(initial.getFullYear(), initial.getMonth(), 1),
  );
  const [selected, setSelected] = useState(initial.getDate());
  const [hour, setHour] = useState(String(initial.getHours() % 12 || 12));
  const [minute, setMinute] = useState(String(initial.getMinutes()).padStart(2, "0"));
  const [period, setPeriod] = useState(initial.getHours() >= 12 ? "PM" : "AM");
  const [timeOpen, setTimeOpen] = useState(false);
  const [pendingTime, setPendingTime] = useState({ hour, minute, period });
  const [timeError, setTimeError] = useState<string | null>(null);
  const dayCount = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const offset = month.getDay();
  const currentMonth = new Date(earliestTime.getFullYear(), earliestTime.getMonth(), 1);
  const previousMonthAvailable = month.getTime() > currentMonth.getTime();
  const selectedDayAvailable = scheduleDayAvailable(new Date(month.getFullYear(), month.getMonth(), selected), now, earliestTime);
  function changeMonth(direction: -1 | 1) {
    const today = new Date();
    const target = new Date(month.getFullYear(), month.getMonth() + direction, 1);
    const earliest = earliestDeliveryTime(draft.service?.serviceName, draft.deliveryType);
    if (target < new Date(earliest.getFullYear(), earliest.getMonth(), 1)) return;
    setMonth(target);
    setSelected(target.getFullYear() === earliest.getFullYear() && target.getMonth() === earliest.getMonth() ? earliest.getDate() : 1);
    setNow(today);
    setError(null);
  }
  function openTimePicker() {
    setPendingTime({ hour, minute, period });
    setTimeError(null);
    setTimeOpen(true);
  }
  function adjustTime(unit: "hour" | "minute", direction: -1 | 1) {
    setPendingTime(value => ({ ...value, [unit]: unit === "hour"
      ? String(((Number(value.hour) - 1 + direction + 12) % 12) + 1)
      : String((Number(value.minute) + direction + 60) % 60).padStart(2, "0") }));
    setTimeError(null);
  }
  function scheduledAt(time: typeof pendingTime) {
    return new Date(month.getFullYear(), month.getMonth(), selected,
      (Number(time.hour) % 12) + (time.period === "PM" ? 12 : 0), Number(time.minute));
  }
  function validateTime(time: typeof pendingTime) {
    const h = Number(time.hour);
    const m = Number(time.minute);
    if (
      !Number.isInteger(h) ||
      h < 1 ||
      h > 12 ||
      !Number.isInteger(m) ||
      m < 0 ||
      m > 59
    )
      return "Enter a valid time.";
    const date = scheduledAt(time);
    if (!scheduleDayAvailable(date)) return "Choose today or a later date.";
    if (!validFutureSchedule(date.toISOString()) || date.getHours() < 4)
      return "Choose a future time between 4 AM and 11 PM.";
    return deliveryScheduleError(date.toISOString(), draft.service?.serviceName, draft.deliveryType);
  }
  function saveTime() {
    const validation = validateTime(pendingTime);
    if (validation) { setTimeError(validation); return; }
    setHour(pendingTime.hour);
    setMinute(pendingTime.minute);
    setPeriod(pendingTime.period);
    setError(null);
    setTimeOpen(false);
  }
  function confirm() {
    const time = { hour, minute, period };
    const validation = validateTime(time);
    if (validation) { setNow(new Date()); setError(validation); return; }
    draft.set({ schedule: scheduledAt(time).toISOString() });
    if (onDone) onDone();
    else router.back();
  }
  const Container = embedded ? EmbeddedOrderPanel : Screen;
  return (
    <Container
      title="Select Delivery Schedule"
      background={palette.surface}
      footer={
        <View style={{ width: "100%", maxWidth: 520, alignSelf: "center" }}>
          <FormError error={error} />
          <Button
            title="Confirm Schedule"
            color={palette.navy}
            onPress={confirm}
            disabled={!selectedDayAvailable}
          />
        </View>
      }
    >
      <View style={[styles.stack, { width: "100%", maxWidth: 520, alignSelf: "center" }]}>
        <View style={styles.row}>
          <View style={{ padding: 12, borderRadius: 14, backgroundColor: palette.lavender }}>
            <CalendarDays size={24} color={palette.navy} />
          </View>
          <View style={styles.grow}>
            <Txt style={styles.heading}>Choose your date and time</Txt>
            <Txt style={styles.muted}>Select today or a later date.</Txt>
          </View>
        </View>
        <Card style={{ padding: 20 }}>
          <Section title="Delivery time" />
          {leadMinutes > 0 && <View style={{ gap: 4 }}>
            <Txt style={styles.muted}>Full Service delivery needs at least 2 hours for washing, drying, and preparation.</Txt>
            <Txt style={{ color: palette.navy, fontWeight: "600" }}>
              Earliest delivery: {earliestTime.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </Txt>
          </View>}
          <Pressable accessibilityRole="button" accessibilityLabel="Change delivery time"
            accessibilityValue={{ text: `${hour.padStart(2, "0")}:${minute.padStart(2, "0")} ${period}` }}
            onPress={openTimePicker}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12,
              padding: 16, borderRadius: 12, borderWidth: 1, borderColor: palette.line,
              backgroundColor: pressed ? palette.lavender : palette.surface })}>
            <Clock size={24} color={palette.navy} />
            <View style={styles.grow}>
              <Txt style={{ fontSize: 24, fontWeight: "600", color: palette.navy }}>
                {hour.padStart(2, "0")}:{minute.padStart(2, "0")} {period}
              </Txt>
              <Txt style={styles.muted}>Tap to change time</Txt>
            </View>
            <Pencil size={18} color={palette.navy} />
          </Pressable>
        </Card>
        <Modal visible={timeOpen} transparent animationType="fade" onRequestClose={() => setTimeOpen(false)}>
          {timeOpen && <View style={{ flex: 1, backgroundColor: "#00000070", justifyContent: "center", alignItems: "center", padding: 20 }}>
          <Card style={{ width: "100%", maxWidth: 420, maxHeight: "90%", padding: 24 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 16 }}>
          <Txt style={styles.heading}>Select delivery time</Txt>
          <Txt style={styles.muted}>Use the arrows to adjust the hour and minute.</Txt>
          {leadMinutes > 0 && <Txt style={styles.muted}>
            Full Service delivery is available from {earliestTime.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.
          </Txt>}
          <View style={[styles.row, { justifyContent: "center", gap: 10 }]}>
            {(["hour", "minute"] as const).map((unit, index) => (
              <View key={unit} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
                {index === 1 && <Txt style={{ fontSize: 28, color: palette.navy, marginTop: 24 }}>:</Txt>}
                <View style={{ flex: 1, gap: 8 }}>
                  <Txt style={{ color: palette.muted, textAlign: "center" }}>{unit === "hour" ? "Hour" : "Minute"}</Txt>
                  <View style={{ alignItems: "center", padding: 6, borderRadius: 14,
                    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line }}>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Increase ${unit}`}
                      onPress={() => adjustTime(unit, 1)}
                      style={({ pressed }) => ({ width: "100%", minHeight: 40, alignItems: "center",
                        justifyContent: "center", borderRadius: 8, backgroundColor: pressed ? palette.lavender : "transparent" })}>
                      <ChevronUp size={22} color={palette.navy} />
                    </Pressable>
                    <Txt accessibilityLabel={`Selected ${unit}`} accessibilityLiveRegion="polite"
                      style={{ fontSize: 30, fontWeight: "600", color: palette.navy, paddingVertical: 4 }}>
                      {String(Number(unit === "hour" ? pendingTime.hour : pendingTime.minute)).padStart(2, "0")}
                    </Txt>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Decrease ${unit}`}
                      onPress={() => adjustTime(unit, -1)}
                      style={({ pressed }) => ({ width: "100%", minHeight: 40, alignItems: "center",
                        justifyContent: "center", borderRadius: 8, backgroundColor: pressed ? palette.lavender : "transparent" })}>
                      <ChevronDown size={22} color={palette.navy} />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: "row", backgroundColor: palette.surface, borderRadius: 12, padding: 4 }}>
            {["AM", "PM"].map(value => <Pressable key={value} accessibilityRole="radio"
              accessibilityLabel={value} accessibilityState={{ checked: pendingTime.period === value }}
              onPress={() => { setPendingTime(current => ({ ...current, period: value })); setTimeError(null); }}
              style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 9,
                backgroundColor: pendingTime.period === value ? palette.navy : "transparent" }}>
              <Txt style={{ fontWeight: "600", color: pendingTime.period === value ? "white" : palette.muted }}>{value}</Txt>
            </Pressable>)}
          </View>
          <FormError error={timeError} />
          <View style={styles.row}>
            <Button title="Cancel" outline color={palette.navy} style={styles.grow} onPress={() => setTimeOpen(false)} />
            <Button title="Save Time" color={palette.navy} style={styles.grow} onPress={saveTime} />
          </View>
          </ScrollView>
          </Card>
          </View>}
        </Modal>
        <Card style={{ padding: 16 }}>
          <View style={styles.between}>
            <Pressable
              accessibilityLabel="Previous month"
              accessibilityRole="button"
              accessibilityState={{ disabled: !previousMonthAvailable }}
              disabled={!previousMonthAvailable}
              onPress={() => changeMonth(-1)}
              style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: palette.surface }}
            >
              <Txt style={[styles.heading, !previousMonthAvailable && { color: palette.muted }]}>‹</Txt>
            </Pressable>
            <Txt style={styles.heading}>
              {month.toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              })}
            </Txt>
            <Pressable
              accessibilityLabel="Next month"
              accessibilityRole="button"
              onPress={() => changeMonth(1)}
              style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: palette.surface }}
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
                  textAlign: "center", paddingVertical: 12,
                  color: palette.muted,
                }}
              >
                {day}
              </Txt>
            ))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {Array.from({ length: offset + dayCount }, (_, i) => {
              const day = i - offset + 1;
              const date = new Date(month.getFullYear(), month.getMonth(), day);
              const available = i >= offset && scheduleDayAvailable(date, now, earliestTime);
              const isSelected = available && selected === day;
              return (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={i >= offset ? date.toLocaleDateString() : undefined}
                accessibilityState={{ disabled: !available, selected: isSelected }}
                disabled={!available}
                onPress={() => {
                  if (!scheduleDayAvailable(date, new Date(), earliestDeliveryTime(draft.service?.serviceName, draft.deliveryType))) { setNow(new Date()); return; }
                  setSelected(day); setError(null);
                }}
                style={{
                  width: `${100 / 7}%`,
                  height: 48,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
                  backgroundColor: isSelected ? palette.navy : "transparent" }}>
                <Txt
                  style={{
                    color: isSelected ? "white" : available ? palette.navy : palette.muted,
                  }}
                >
                  {i >= offset ? i - offset + 1 : ""}
                </Txt>
                </View>
              </Pressable>
              );
            })}
          </View>
        </Card>
        <View style={{ padding: 16, borderRadius: 12, backgroundColor: palette.lavender }}>
          <Txt style={{ color: palette.navy, fontWeight: "600" }}>Selected delivery date</Txt>
          <Txt style={{ color: palette.navy, marginTop: 4 }}>{new Date(
            month.getFullYear(), month.getMonth(), selected,
          ).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</Txt>
        </View>
      </View>
    </Container>
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
  const { go } = useFlowNavigation();
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
                pathname: "/shop/customers/orders/[id]",
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
  const { go } = useFlowNavigation();
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
  const { go, inShop } = useFlowNavigation();
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
              inShop ? go("shop-menu", { id: String(order.shopId) }) : router.push({
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
            title={order.deliveryType === "Pickup" ? "Pickup location" : order.userName}
            detail={address(order)}
            asset="delivery.png"
          />
          <DeliveryDetails value={order} />
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
          {!!order.notes && <Txt style={styles.muted}>{order.notes}</Txt>}
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
  const { replaceFlow } = useFlowNavigation();
  const orders = useOrders();
  const order = orders.data?.find((o) => o.id === id);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const cache = useQueryClient();
  async function cancel() {
    if (submitting.current) return;
    if (!order || order.status !== "Pending") {
      setError("You can only cancel a pending order before it is accepted.");
      return;
    }
    if (!reason.trim()) {
      setError("Please select a cancellation reason.");
      return;
    }
    submitting.current = true;
    setBusy(true); setError(null);
    try {
      if (!await confirmAction("Cancel Order", "Are you sure you want to cancel your order?")) return;
      const cancelled = await api.put<Order>(`/transactions/${id}/cancel`, { reason: reason.trim() });
      for (const key of ["user-orders", "shop-orders"]) {
        cache.setQueriesData<Order[]>({ queryKey: [key] }, (current) =>
          current?.map((entry) => entry.id === id ? { ...entry, ...cancelled } : entry));
      }
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["user-orders"] }),
        cache.invalidateQueries({ queryKey: ["shop-orders"] }),
      ]);
      replaceFlow("order-cancelled", { id: String(id) });
    } catch (failure) {
      setError(message(failure));
      void orders.refetch();
    } finally {
      submitting.current = false;
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
          disabled={!reason.trim() || !order || order.status !== "Pending"}
          busy={busy}
          onPress={cancel}
        />
      }
    >
      <View style={styles.stack}>
        <QueryState loading={orders.isLoading} error={orders.error} retry={() => orders.refetch()} />
        {!orders.isLoading && !orders.error && !order && <Empty title="Order not found" />}
        <FormError error={error} />
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
            onPress={() => { setReason(value); setError(null); }}
          />
        ))}
      </View>
    </Screen>
  );
}
