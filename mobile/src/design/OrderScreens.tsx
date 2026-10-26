import { ORDERS_PER_PAGE, PageControls } from "./Pagination";
import { useEffect, useCallback, useRef, useState, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import {
  Clock,
  CheckCircle2,
  ChevronDown,
  History,
  Minus,
  Plus,
  Pencil,
  Truck,
} from "lucide-react-native";
import { router, useFocusEffect } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthStore } from "../store/authStore";
import { DeliveryOrderDesign } from './DeliveryScreens';
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
  useProfile,
  type Order,
  type Shop,
  type Profile,
} from "./data";
import { addressError, addressPayload } from "./address";
import { DeliveryDetails, FormError } from "./AddressFields";
import { message } from "./data";
import { clothingNames, householdNames, useLaundryDraft } from "./store";
import { orderPricing } from "./order-pricing";
import { validateDeliveryTime } from "./delivery-slots";
import { TurnaroundDetails, orderUpdateText } from "./TurnaroundDetails";
import { DeliverySchedule } from "./DeliverySchedule";
import { QueryState } from "./UserScreens";
import { serviceAreaError, serviceAreaLabel } from "./service-area";
import { shopAvailability } from "./shop-hours";
import { useShopAvailability } from "./useShopAvailability";

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
  const palette = usePalette();
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
  const palette = usePalette();
  const { replaceFlow, go } = useFlowNavigation();
  const draft = useLaundryDraft();
  const user = useAuthStore(state => state.user);
  const availability = useShopAvailability(draft.shop);
  const profile = useProfile();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownTimers = useRef<{ timeout: ReturnType<typeof setTimeout>; interval: ReturnType<typeof setInterval> } | null>(null);
  const cancelCountdown = useCallback(() => {
    if (countdownTimers.current) {
      clearTimeout(countdownTimers.current.timeout);
      clearInterval(countdownTimers.current.interval);
      countdownTimers.current = null;
    }
    setCountdown(null);
  }, []);
  useFocusEffect(useCallback(() => cancelCountdown, [cancelCountdown]));
  const [dialog, setDialog] = useState<"items" | "address" | "schedule" | null>(null);
  const [transportOpen, setTransportOpen] = useState(false);
  const cache = useQueryClient();
  const customerAddress = draft.address || profile.data;
  const deliveryAddress = draft.deliveryType === "Pickup" ? draft.shop : customerAddress;
  const areaError = draft.shop ?
    (draft.deliveryType === "Deliver" ? serviceAreaError(draft.shop, customerAddress, "delivery") : null)
    || (draft.collectionMethod === "ShopPickup" ? serviceAreaError(draft.shop, customerAddress, "pickup") : null) : null;
  const transportOptions: { label: string; description: string; collectionMethod: "Dropoff" | "ShopPickup"; deliveryType: "Deliver" | "Pickup" }[] = [
    { label: "Pickup & delivery", description: "The shop picks up your dirty laundry and delivers it back clean.", collectionMethod: "ShopPickup", deliveryType: "Deliver" },
    { label: "Pickup only", description: "The shop picks up your dirty laundry. You collect it at the shop when clean.", collectionMethod: "ShopPickup", deliveryType: "Pickup" },
    { label: "Delivery only", description: "You drop off your dirty laundry. The shop delivers it back clean.", collectionMethod: "Dropoff", deliveryType: "Deliver" },
    { label: "I'll handle both trips", description: "You drop off your dirty laundry and collect it at the shop when clean.", collectionMethod: "Dropoff", deliveryType: "Pickup" },
  ];
  const selectedTransport = transportOptions.find(option => option.collectionMethod === (draft.collectionMethod || "Dropoff") && option.deliveryType === draft.deliveryType);
  const totals = draftTotals();
  const savedAddresses = useQuery({
    queryKey: ["saved-addresses", user?.id], enabled: !!user,
    queryFn: async () => {
      const raw = await AsyncStorage.getItem(`labaride-addresses:${user!.id}`);
      return raw ? JSON.parse(raw) as Partial<Profile>[] : [];
    },
  });
  function chooseAddress() {
    setDialog("address");
  }
  function selectAddress(value: Partial<Profile> | null) {
    draft.set({ address: value });
    setError(null);
    setDialog(null);
  }
  function manageAddresses() {
    setDialog(null);
    go("addresses", { checkout: "true" });
  }
  const addressOptions = [
    ...(profile.data ? [{ label: "Primary address", value: profile.data, primary: true }] : []),
    ...(savedAddresses.data || []).map((value, index) => ({ label: "Saved address " + (index + 1), value, primary: false })),
  ];
  async function submit(confirmed = false) {
    if (!draft.shop || !draft.service) return;
    if (!user) { router.push("/(auth)/login"); return; }
    const currentAvailability = shopAvailability(draft.shop);
    if (!currentAvailability.isOpen) { setError(currentAvailability.message); return; }
    if (submitting.current || busy || countdownTimers.current) return;
    if (dialog) { setError("Finish editing your order details before placing the order."); return; }
    const locationError = addressError(deliveryAddress)
      || (draft.collectionMethod === "ShopPickup" ? addressError(customerAddress) : null);
    const scheduleError = draft.collectionMethod !== "ShopPickup" ? null : !draft.requestedPickupAt
      ? "Choose your requested laundry pickup date and time."
      : validateDeliveryTime(draft.requestedPickupAt, { ...draft.shop, preparationMinutes: 0 }, Date.now())?.replace(/delivery/gi, "pickup") || null;
    const validation = totals.kilos === null ? "Enter a weight above 0 kg with up to two decimal places." :
      totals.pricingError ? totals.pricingError :
      scheduleError ? scheduleError :
        locationError && draft.deliveryType === "Pickup" && addressError(deliveryAddress) ? "The shop address is incomplete. Ask the shop owner to update Shop Details before booking pickup." : locationError || areaError;
    if (validation) { setError(validation); return; }
    if (totals.kilos === null || totals.subtotal === null || totals.total === null) return;
    setError(null);
    if (!confirmed) {
      const deadline = Date.now() + 5000;
      setCountdown(5);
      const interval = setInterval(() => setCountdown(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))), 1000);
      const timeout = setTimeout(() => {
        cancelCountdown();
        void submit(true);
      }, 5000);
      countdownTimers.current = { timeout, interval };
      return;
    }
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
        collectionMethod: draft.collectionMethod || "Dropoff",
        ...(draft.collectionMethod === "ShopPickup" ? { collectionAddress: addressPayload(customerAddress!) } : {}),
        ...addressPayload(deliveryAddress!),
        ...(draft.collectionMethod === "ShopPickup" ? { requestedPickupAt: draft.requestedPickupAt } : {}),
        paymentMethod: draft.paymentMethod,
        notes: draft.notes,
        items: Object.entries(draft.counts)
          .filter(([, count]) => count > 0)
          .map(([itemName, quantity]) => ({ itemName, quantity })),
      });
      await cache.invalidateQueries({ queryKey: ["user-orders"] });
      draft.clearOrder();
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
              title={user ? availability.isOpen ? "Place Order" : "Shop closed" : "Log In to Place Order"}
              color={palette.navy}
              onPress={() => submit()}
              busy={busy}
              disabled={!!dialog || countdown !== null || (!!user && !availability.isOpen)}
            />
          </View>
        </View>
      }
    >
      <View style={[styles.stack, { width: "100%", maxWidth: 760, alignSelf: "center" }]}>
        <QueryState loading={profile.isLoading} error={profile.error} retry={() => profile.refetch()} />
        {!availability.isOpen && <View accessibilityRole="alert"><FormError error={availability.message} /></View>}
        <Card>
          <Section title="Shop & Selected Services" />
          <Txt style={styles.heading}>{draft.shop?.shopName}</Txt>
          <Txt style={styles.muted}>{address(draft.shop)}</Txt>
          <PriceRow label="Customer" value={profile.data?.name || user?.name || "Log in to place your order"} />
          {!!user && <View style={{ gap: 4, marginBottom: 8 }}>
            <MenuRow title="Customer address" detail={address(customerAddress) || "No address saved. Add one in Profile."}
              asset="locationblue.png" onPress={chooseAddress} />
            {!!addressError(customerAddress) && <FormError error="Complete your address in Profile before checkout." />}
            {(draft.deliveryType === "Deliver" || draft.collectionMethod === "ShopPickup") && customerAddress && <DeliveryDetails value={customerAddress} />}
          </View>}
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
          <Section title="Pickup & Delivery Options" />
          <Txt style={styles.muted}>Choose how your laundry gets to the shop and back to you.</Txt>
          <Pressable accessibilityRole="button" accessibilityLabel="Laundry transport"
            accessibilityState={{ expanded: transportOpen }} accessibilityValue={{ text: selectedTransport?.label }}
            onPress={() => setTransportOpen(open => !open)}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, minHeight: 64,
              borderRadius: 12, borderWidth: 1, borderColor: transportOpen ? palette.primary : palette.line,
              backgroundColor: pressed ? palette.soft : "white" })}>
            <View style={styles.grow}>
              <Txt style={{ fontWeight: "600", color: palette.primary }}>{selectedTransport?.label || "Choose a transport option"}</Txt>
              {!!selectedTransport && <Txt style={{ fontSize: 12, lineHeight: 18, color: palette.muted, marginTop: 4 }}>{selectedTransport.description}</Txt>}
            </View>
            <ChevronDown size={20} color={palette.primary} style={{ transform: [{ rotate: transportOpen ? "180deg" : "0deg" }] }} />
          </Pressable>
          {transportOpen && <View accessibilityRole="radiogroup" accessibilityLabel="Laundry transport options"
            style={{ borderWidth: 1, borderColor: palette.line, borderRadius: 12, overflow: "hidden" }}>
            {transportOptions.filter(option => option.collectionMethod === "Dropoff" || draft.shop?.pickupEnabled).map(option => {
              const selected = (draft.collectionMethod || "Dropoff") === option.collectionMethod && draft.deliveryType === option.deliveryType;
              return <Pressable key={option.label} accessibilityRole="radio" accessibilityLabel={option.label}
                accessibilityHint={option.description} accessibilityState={{ checked: selected }}
                onPress={() => { draft.set({ collectionMethod: option.collectionMethod, deliveryType: option.deliveryType }); setTransportOpen(false); setError(null); }}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, minHeight: 76,
                  backgroundColor: selected || pressed ? palette.soft : "white" })}>
                <View pointerEvents="none" style={{ width: 20, height: 20, borderRadius: 10, borderWidth: selected ? 6 : 1,
                  borderColor: selected ? palette.primary : palette.muted, backgroundColor: "white" }} />
                <View style={styles.grow}>
                  <Txt style={{ fontWeight: "600", color: selected ? palette.primary : palette.ink }}>{option.label}</Txt>
                  <Txt style={{ fontSize: 12, lineHeight: 18, color: palette.muted, marginTop: 4 }}>{option.description}</Txt>
                </View>
              </Pressable>;
            })}
          </View>}
          {!draft.shop?.pickupEnabled && <Txt style={styles.muted}>This shop does not offer pickup from your address.</Txt>}
          {draft.collectionMethod === "ShopPickup" && draft.shop && (draft.shop.pickupMaxKm != null || Number(draft.shop.pickupMinKm) > 0) &&
            <Txt style={styles.muted}>Shop pickup range: {serviceAreaLabel(draft.shop, "pickup")}</Txt>}
          {draft.deliveryType === "Deliver" && draft.shop && (draft.shop.deliveryMaxKm != null || Number(draft.shop.deliveryMinKm) > 0) &&
            <Txt style={styles.muted}>Delivery range: {serviceAreaLabel(draft.shop, "delivery")}</Txt>}
          {(draft.deliveryType === "Deliver" || draft.collectionMethod === "ShopPickup") && <>
            {areaError && <View accessibilityRole="alert" accessibilityLiveRegion="polite"
              style={{ padding: 14, borderRadius: 12, borderWidth: 1, borderColor: "#FECDD3", backgroundColor: "#FFF1F2", gap: 10 }}>
              <Txt style={{ color: palette.danger, fontWeight: "600" }}>Address needs attention</Txt>
              <Txt style={{ color: palette.danger }}>{areaError.startsWith("Pin your") ? "Update your saved address with a map pin in Profile so we can check the shop's service area." : areaError}</Txt>
              {areaError.startsWith("Pin your") && <Button title="Manage addresses" color={palette.danger} outline onPress={manageAddresses} />}
            </View>}
          </>}
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
          <Section title="Turnaround & Updates" />
          <Txt style={{ fontWeight: "600" }}>Your laundry’s completion time will be confirmed by the shop.</Txt>
          <Txt style={styles.muted}>After receiving your laundry, the shop will estimate when it will be ready based on its queue. You’ll receive updates when processing starts and when it’s ready.</Txt>
          {draft.collectionMethod === "ShopPickup" ? <>
            <MenuRow title="Requested laundry pickup" detail={draft.requestedPickupAt
              ? new Date(draft.requestedPickupAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" }) + " (Philippine time)"
              : "Choose a pickup date and time"} asset="Time.png" onPress={() => setDialog("schedule")} />
            <Txt style={styles.muted}>The shop must confirm pickup availability.</Txt>
          </> : <>
            <Txt style={{ fontWeight: "600" }}>Customer drop-off</Txt>
            <Txt style={styles.muted}>Operating hours: {draft.shop?.openingTime} – {draft.shop?.closingTime} (Philippine time). Bring your laundry to the shop during these hours.</Txt>
          </>}
          <Txt style={styles.muted}>{draft.deliveryType === "Deliver"
            ? "Return delivery will be arranged once your laundry is ready."
            : "We’ll notify you when your laundry is ready to collect."}</Txt>
        </Card>
        <Card>
          <Section title="Note to Laundry Shop" />
          <Field label="Order Notes (optional)" placeholder="Special instructions for your laundry" multiline
            value={draft.notes} onChangeText={notes => draft.set({ notes })} />
        </Card>
        <Card>
          <Section title="Payment Method" />
          <PaymentDropdown />
          <Section title="Fees & Total" />
          <Totals />
        </Card>
      </View>
      <Modal visible={!!dialog} transparent animationType="none" onRequestClose={() => setDialog(null)}>
        {dialog && <View style={{ flex: 1, backgroundColor: "#00000070", justifyContent: "center", alignItems: "center", padding: 20 }}>
          {dialog === "schedule" ? <ScheduleDesign embedded inDialog pickup onDone={() => setDialog(null)} onClose={() => setDialog(null)} /> : <Card style={{ width: "100%", maxWidth: 540, maxHeight: "90%", padding: 24 }}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 16 }}>
              <View style={[styles.between, { flexWrap: "wrap" }]}>
                <Txt style={styles.heading}>{dialog === "items" ? "Laundry Items" : "Choose your address"}</Txt>
                <Button title="Close" compact outline color={palette.navy} onPress={() => setDialog(null)} />
              </View>
              {dialog === "items" ? <LaundryCountDesign embedded onDone={() => setDialog(null)} /> : <View>
                <Txt style={styles.muted}>Choose an address you saved in your profile. Add or edit addresses in Profile before placing your order.</Txt>
                <QueryState loading={savedAddresses.isLoading} error={savedAddresses.error} retry={() => savedAddresses.refetch()} />
                <View accessibilityRole="radiogroup" accessibilityLabel="Saved addresses" style={{ gap: 10, marginVertical: 14 }}>
                  {addressOptions.map((option, index) => {
                    const invalid = addressError(option.value);
                    const selected = option.primary ? !draft.address : !!draft.address &&
                      JSON.stringify(addressPayload(draft.address)) === JSON.stringify(addressPayload(option.value));
                    return <Pressable key={index} accessibilityRole="radio" accessibilityLabel={option.label}
                      accessibilityState={{ checked: selected, disabled: !!invalid }} disabled={!!invalid}
                      onPress={() => selectAddress(option.primary ? null : option.value)}
                      style={({ pressed }) => ({ padding: 14, borderRadius: 12, borderWidth: 1,
                        borderColor: selected ? palette.primary : palette.line, backgroundColor: selected || pressed ? palette.soft : "white", gap: 6, opacity: invalid ? 0.6 : 1 })}>
                      <View style={styles.between}>
                        <Txt style={{ fontWeight: "600", color: palette.primary }}>{option.label}{option.value.address_type ? " - " + option.value.address_type : ""}</Txt>
                        {selected && <CheckCircle2 size={18} color={palette.primary} />}
                      </View>
                      <Txt style={styles.muted}>{address(option.value) || "Address not configured"}</Txt>
                      {!!invalid && <Txt style={styles.muted}>Incomplete address. Update it in Profile.</Txt>}
                    </Pressable>;
                  })}
                </View>
                {!addressOptions.length && <Txt style={styles.muted}>No addresses saved yet. Add your address in Profile before checkout.</Txt>}
                {!!user && <Button title="Manage addresses in Profile" compact outline onPress={manageAddresses} />}
              </View>}
            </ScrollView>
          </Card>}
        </View>}
      </Modal>
      <Modal visible={countdown !== null} transparent animationType="fade" onRequestClose={cancelCountdown}>
        <View style={{ flex: 1, backgroundColor: "#00000070", justifyContent: "center", alignItems: "center", padding: 20 }}>
          <Card style={{ width: "100%", maxWidth: 440, padding: 28, gap: 20 }}>
            <View style={{ alignItems: "center", gap: 12 }}>
              <Clock size={32} color={palette.primary} />
              <Txt accessibilityRole="header" style={styles.heading}>Placing your order soon</Txt>
              <Txt accessibilityLiveRegion="polite" style={{ fontSize: 40, fontWeight: "700", color: palette.primary }}>{countdown}</Txt>
              <Txt style={[styles.muted, { textAlign: "center" }]}>Your order will be sent automatically when the countdown ends. You can still modify your details now.</Txt>
            </View>
            <Button title="Modify order" outline color={palette.navy} icon={<Pencil size={18} color={palette.navy} />} onPress={cancelCountdown} />
          </Card>
        </View>
      </Modal>
    </Screen>
  );
}
export function ScheduleDesign({ embedded = false, inDialog = false, pickup = false, onDone, onClose }: {
  embedded?: boolean; inDialog?: boolean; pickup?: boolean; onDone?: () => void; onClose?: () => void;
} = {}) {
  return <DeliverySchedule pickup={pickup} embedded={embedded || inDialog} onDone={onDone} onClose={onClose} />;
}
function PaymentDropdown() {
  const palette = usePalette();
  const draft = useLaundryDraft();
  const [open, setOpen] = useState(false);
  return <View style={{ gap: 10 }}>
    <Pressable accessibilityRole="button" accessibilityLabel="Payment method"
      accessibilityState={{ expanded: open }} accessibilityValue={{ text: "Cash on Delivery" }}
      onPress={() => setOpen(value => !value)}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, minHeight: 54,
        borderRadius: 12, borderWidth: 1, borderColor: open ? palette.primary : palette.line,
        backgroundColor: pressed ? palette.soft : "white" })}>
      <Txt style={{ flex: 1, color: palette.primary, fontWeight: "600" }}>Cash on Delivery</Txt>
      <ChevronDown size={20} color={palette.primary} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
    </Pressable>
    {open && <View accessibilityRole="radiogroup" accessibilityLabel="Payment options" style={{ gap: 10 }}>
    <Choice label="Cash on Delivery" selected={draft.paymentMethod === "Cash on Delivery"}
      onPress={() => { draft.set({ paymentMethod: "Cash on Delivery" }); setOpen(false); }} />
    {["Bank Transfer", "GCash"].map(label => <Pressable key={label} disabled
      accessibilityRole="radio" accessibilityLabel={`${label}, coming soon`}
      accessibilityState={{ disabled: true, checked: false }}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14,
        borderRadius: 12, borderWidth: 1, borderColor: palette.line, backgroundColor: "#F5F6F8" }}>
      <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: palette.muted }} />
      <Txt style={{ flex: 1, color: palette.muted }}>{label}</Txt>
      <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: "#E8EBF0" }}>
        <Txt style={{ fontSize: 11, color: palette.muted, fontWeight: "600" }}>Coming soon</Txt>
      </View>
    </Pressable>)}
    </View>}
    <Txt style={styles.muted}>Bank transfer and GCash payments are coming soon. Please use Cash on Delivery for now.</Txt>
  </View>;
}
export function PaymentDesign() {
  const palette = usePalette();
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
        <PaymentDropdown />
      </Card>
    </Screen>
  );
}
export function VouchersDesign() { return <Screen title="Your vouchers"><Empty title="No vouchers available" message="There are no supported voucher offers to display." /></Screen>; }
export function StatusBadge({ status }: { status: Order["status"] }) {
  const palette = usePalette();
  const colors = {
    Pending: palette.warning,
    Accepted: palette.primary,
    Queued: palette.warning,
    Ready: palette.successInk,
    Processing: palette.primary,
    Completed: palette.successInk,
    Cancelled: palette.danger,
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
  const palette = usePalette();
  const { go } = useFlowNavigation();
  return (
    <Card>
      <Txt style={{ color: palette.muted, fontSize: 12 }}>
        {new Date(order.createdAt).toLocaleString()}
      </Txt>
      <View style={styles.between}>
        <Txt style={{ fontWeight: "600" }}>Order ID: #{order.id}</Txt>
        <StatusBadge status={order.status} />
        {order.workflowStatus && <Txt style={{ fontSize: 12 }}>{order.workflowStatus.replace(/([a-z])([A-Z])/g, '$1 $2')}</Txt>}
      </View>
      <Txt style={styles.muted}>
        {shopMode ? order.userName : order.shop?.shopName || "Laundry Shop"}
      </Txt>
      <Txt style={styles.muted}>Service: {order.serviceName}</Txt>
      <View style={styles.between}>
        <View>
          <Txt style={{ color: palette.muted, fontSize: 12 }}>Order total</Txt>
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
  const palette = usePalette();
  const { go } = useFlowNavigation();
  const orders = useOrders();
  const user = useAuthStore((state) => state.user);
  const [tab, setTab] = useState(past ? "Past Order" : "Active Order");
  const [requestedPage, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [tab, history, past]);
  const filtered = (orders.data || []).filter(
    (order) =>
      !history ||
      (tab === "Past Order"
        ? ["Completed", "Cancelled"].includes(order.status)
        : !["Completed", "Cancelled"].includes(order.status)),
  );
  const page = Math.min(requestedPage, Math.max(0, Math.ceil(filtered.length / ORDERS_PER_PAGE) - 1));
  useEffect(() => { setPage(page); }, [page]);
  return (
    <Screen
      title={history ? "History" : "Activity"}
      dark={!history}
      background={palette.surface}
      back={history}
      right={
        !history && (
          <Pressable accessibilityRole="button"
            onPress={() => go("history")}
            style={{ backgroundColor: "white", padding: 10, borderRadius: 12 }}
          >
            <View style={[styles.row, { gap: 6 }]}>
              <History size={16} color={palette.primary} />
              <Txt style={{ fontSize: 12, color: palette.primary }}>History</Txt>
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
              <Section title="Recent" light={false} />
            )}
            <QueryState
              loading={orders.isLoading}
              error={orders.error}
              retry={() => orders.refetch()}
            />
            {filtered.slice(page * ORDERS_PER_PAGE, (page + 1) * ORDERS_PER_PAGE).map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
            {!orders.isLoading && !orders.error && filtered.length > 0 && <PageControls page={page} total={filtered.length} onChange={setPage} />}
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
  const palette = usePalette();
  const { go, inShop } = useFlowNavigation();
  const orders = useOrders();
  const order = orders.data?.find((o) => o.id === id);
  if (order?.workflowStatus) return <DeliveryOrderDesign id={id} />;
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
                {orderUpdateText(order)}
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
          {order.collectionMethod === "ShopPickup" && order.collectionAddress && <>
            <Section title="Laundry Collection Address" />
            <Txt style={styles.muted}>{address(order.collectionAddress)}</Txt>
            <DeliveryDetails value={order.collectionAddress} />
          </>}
          <MenuRow
            title={order.shop?.shopName || "Laundry Shop"}
            detail={order.shop?.address}
            asset="shop.png"
          />
          <PriceRow label="Order ID:" value={`#${order.id}`} />
          <PriceRow label="Payment Method" value={order.paymentMethod} />
          <TurnaroundDetails order={order} />
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
  const palette = usePalette();
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
    setError(null);
    try {
      if (!await confirmAction("Cancel Order", "Are you sure you want to cancel your order?", { confirmLabel: "Cancel Order", destructive: true })) return;
      setBusy(true);
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
