import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { router } from "expo-router";
import { Button, Field, Screen, Txt, styles, usePalette } from "./ui";
import { FormError } from "./AddressFields";
import { message, useShop } from "./data";
import { useLaundryDraft } from "./store";
import { deliveryLeadMinutes } from "./schedule";
import { timeInputValue } from "./form-values";
import { shopAvailability } from "./shop-hours";
import { addDeliveryDays, availableDeliverySlots, deliveryDay, deliveryTimestamp, earliestDeliverySlot, earliestOnDeliveryDay,
  formatDeliveryDay, formatDeliveryTime, validateDeliveryTime, type DeliveryRules } from "./delivery-slots";

export function DeliverySchedule({ embedded = false, pickup = false, onDone, onClose }: {
  embedded?: boolean; pickup?: boolean; onDone?: () => void; onClose?: () => void;
}) {
  const palette = usePalette();
  const draft = useLaundryDraft();
  const fresh = useShop(draft.shop?.id || 0);
  const shop = fresh.data || draft.shop;
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(() => Date.now());
  const closeButton = useRef<View>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    if (Platform.OS === "web") closeButton.current?.focus();
    return () => clearInterval(timer);
  }, []);
  const serviceName = draft.serviceIds.map(id => shop?.services?.find(service => service.id === id)?.serviceName).filter(Boolean).join(", ") || draft.service?.serviceName;
  const preparationMinutes = pickup ? 0 : deliveryLeadMinutes(serviceName, draft.deliveryType);
  const rules: DeliveryRules = { ...shop, preparationMinutes };
  const earliest = earliestDeliverySlot(rules, now);
  const saved = pickup ? draft.requestedPickupAt : draft.schedule;
  const savedValid = !!saved && !validateDeliveryTime(saved, rules, now, 6);
  const initial = savedValid ? Date.parse(saved) : earliest;
  const [day, setDay] = useState(() => deliveryDay(initial ?? now));
  const [chosen, setChosen] = useState(() => initial === null ? "" : new Date(initial).toISOString());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [month, setMonth] = useState(() => deliveryDay(initial ?? now).slice(0, 7));
  const [exactOpen, setExactOpen] = useState(false);
  const [exactTime, setExactTime] = useState("");
  const [exactError, setExactError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const suggested = availableDeliverySlots(day, rules, now);
  const validChosen = !!chosen && !validateDeliveryTime(chosen, rules, now, 6) && deliveryDay(chosen) === day;
  const slots = validChosen && !suggested.includes(chosen) ? [...suggested, chosen].sort((a, b) => Date.parse(a) - Date.parse(b)) : suggested;
  const selected = validChosen ? chosen : exactOpen ? "" : slots[0] || "";
  const today = deliveryDay(now);
  const availability = shopAvailability(shop, now);
  const loading = fresh.isLoading && !shop;
  const close = () => onClose ? onClose() : router.back();
  const hours = Math.floor(preparationMinutes / 60), minutes = preparationMinutes % 60;
  const preparationText = preparationMinutes ? "At least " + [hours ? `${hours} ${hours === 1 ? "hour" : "hours"}` : "", minutes ? `${minutes} min` : ""].filter(Boolean).join(" ") : "No additional minimum";

  function chooseDay(next: string) {
    const available = availableDeliverySlots(next, rules, Date.now());
    setDay(next);
    setChosen(available[0] || "");
    setMonth(next.slice(0, 7));
    setCalendarOpen(false);
    setExactOpen(false);
    setExactTime("");
    setExactError(null);
    setError(null);
    setNow(Date.now());
  }
  function changeMonth(direction: number) {
    const [year, number] = month.split("-").map(Number);
    const next = new Date(Date.UTC(year, number - 1 + direction, 1)).toISOString().slice(0, 7);
    if (next >= today.slice(0, 7)) setMonth(next);
  }
  function chooseExact(text: string) {
    setExactTime(text);
    setError(null);
    const normalized = timeInputValue(text);
    if (!normalized) { setChosen(""); setExactError("Enter a time such as 17:45 or 5:45 PM."); return; }
    const [hour, minute] = normalized.split(":").map(Number);
    const value = new Date(deliveryTimestamp(day, hour * 60 + minute)).toISOString();
    const validation = validateDeliveryTime(value, rules, Date.now(), 6);
    setExactError(pickup ? validation?.replace(/delivery/gi, "pickup") || null : validation);
    setChosen(validation ? "" : value);
  }
  function confirm() {
    const current = Date.now();
    const failure = fresh.error ? "Refresh the shop's availability before confirming." : !shopAvailability(shop, current).isOpen
      ? shopAvailability(shop, current).message : !selected ? "Choose an available delivery time." : validateDeliveryTime(selected, rules, current, 6);
    if (failure) { setError(pickup ? failure.replace(/delivery/gi, "pickup") : failure); setNow(current); return; }
    draft.set(pickup ? { requestedPickupAt: selected } : { schedule: selected });
    if (onDone) onDone(); else router.back();
  }
  const monthDate = new Date(month + "-01T12:00:00+08:00");
  const offset = monthDate.getUTCDay();
  const [calendarYear, calendarMonth] = month.split("-").map(Number);
  const days = new Date(Date.UTC(calendarYear, calendarMonth, 0)).getUTCDate();
  const content = <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}
    accessibilityViewIsModal aria-labelledby="delivery-schedule-title"
    style={{ width: "100%", maxWidth: 560, alignSelf: "center", height: Math.min(720, Math.max(180, height - insets.top - insets.bottom - 48)),
      borderRadius: embedded ? 20 : 0, backgroundColor: "white", overflow: "hidden" }}>
    <View style={{ flexDirection: "row", alignItems: "flex-start", padding: 16, gap: 8, borderBottomWidth: 1, borderBottomColor: palette.line, flexShrink: 0 }}>
      <View style={styles.grow}>
        <Txt nativeID="delivery-schedule-title" accessibilityRole="header" style={{ fontSize: 19, fontWeight: "700" }}>{pickup ? "Requested laundry pickup" : "Schedule Delivery"}</Txt>
        <Txt style={{ color: palette.muted, fontSize: 12, marginTop: 4 }}>{pickup ? "When should the shop collect your unwashed laundry?" : "When would you like your clean laundry delivered?"}</Txt>
      </View>
      <Pressable ref={closeButton} accessibilityRole="button" accessibilityLabel={pickup ? "Close pickup request" : "Close delivery schedule"} onPress={close}
        style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? palette.soft : "white" })}>
        <X size={20} color={palette.muted} />
      </Pressable>
    </View>
    <ScrollView testID="delivery-schedule-body" style={{ flex: 1, minHeight: 0 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 14 }}>
      {loading && <ActivityIndicator accessibilityLabel="Loading delivery availability" color={palette.primary} />}
      {!!fresh.error && <View accessibilityRole="alert" style={{ gap: 8 }}><Txt>{message(fresh.error)}</Txt><Button title="Retry availability" outline compact onPress={() => { void fresh.refetch(); }} /></View>}
      <View style={{ backgroundColor: palette.soft, padding: 12, borderRadius: 12, gap: 4 }}>
        <Txt style={{ fontSize: 12 }}>{pickup ? "This is a request. The shop must confirm pickup availability." : `Preparation time: ${preparationText}`}</Txt>
        <Txt style={{ fontSize: 12, fontWeight: "600", color: palette.primary }}>{earliest === null ? `No ${pickup ? "pickup" : "delivery"} times available with the current shop settings.` : `Earliest available: ${formatDeliveryDay(deliveryDay(earliest), now)} at ${formatDeliveryTime(earliest)}`}</Txt>
      </View>
      {!availability.isOpen && <Txt accessibilityRole="alert" style={{ color: palette.muted, fontSize: 12 }}>{availability.message}</Txt>}
      <Txt accessibilityRole="header" style={{ fontWeight: "600" }}>1. Choose {pickup ? "Pickup" : "Delivery"} Date</Txt>
      <View accessibilityRole="radiogroup" accessibilityLabel={pickup ? "Pickup date" : "Delivery date"} style={{ flexDirection: "row", gap: 8 }}>
        {["Today", "Tomorrow", "Next Day"].map((label, index) => {
          const value = addDeliveryDays(today, index);
          const disabled = earliestOnDeliveryDay(value, rules, now) === null;
          const active = day === value && !disabled;
          return <Pressable key={label} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: active, disabled }} disabled={disabled} onPress={() => chooseDay(value)}
            style={({ pressed }) => ({ flex: 1, minWidth: 0, minHeight: 60, padding: 8, borderRadius: 12, borderWidth: 1,
              borderColor: active ? palette.primary : palette.line, backgroundColor: active ? palette.primary : pressed ? palette.soft : "white", opacity: disabled ? 0.4 : 1, alignItems: "center", justifyContent: "center" })}>
            <Txt style={{ fontSize: 12, fontWeight: "600", color: active ? "white" : palette.ink }}>{label}</Txt>
            <Txt style={{ fontSize: 11, color: active ? "white" : palette.muted }}>{new Date(value + "T12:00:00+08:00").toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" })}</Txt>
          </Pressable>;
        })}
      </View>
      <Button title={calendarOpen ? "Hide calendar" : "Choose another date"} compact outline onPress={() => setCalendarOpen(value => !value)} />
      {calendarOpen && <View testID="delivery-calendar" style={{ borderWidth: 1, borderColor: palette.line, borderRadius: 12, padding: 8 }}>
        <View style={styles.row}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous month" disabled={month <= today.slice(0, 7)} accessibilityState={{ disabled: month <= today.slice(0, 7) }} onPress={() => changeMonth(-1)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: month <= today.slice(0, 7) ? 0.35 : 1 }}><ChevronLeft size={20} color={palette.primary} /></Pressable>
          <Txt style={{ flex: 1, textAlign: "center", fontWeight: "600" }}>{monthDate.toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "long", year: "numeric" })}</Txt>
          <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => changeMonth(1)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><ChevronRight size={20} color={palette.primary} /></Pressable>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => <Txt key={`weekday-${index}`} style={{ width: "14.2857%", textAlign: "center", fontSize: 11, color: palette.muted }}>{label}</Txt>)}
          {Array.from({ length: offset + days }, (_, index) => {
            const date = index - offset + 1;
            if (date <= 0) return <View key={index} style={{ width: "14.2857%", height: 44 }} />;
            const value = `${month}-${String(date).padStart(2, "0")}`;
            const disabled = earliestOnDeliveryDay(value, rules, now) === null;
            return <Pressable key={index} accessibilityRole="button" accessibilityLabel={value} accessibilityState={{ selected: day === value, disabled }} disabled={disabled} onPress={() => chooseDay(value)}
              style={{ width: "14.2857%", minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: day === value ? palette.primary : "white", opacity: disabled ? 0.35 : 1 }}>
              <Txt style={{ color: day === value ? "white" : palette.ink, fontSize: 12 }}>{date}</Txt>
            </Pressable>;
          })}
        </View>
      </View>}
      <Txt accessibilityRole="header" style={{ fontWeight: "600" }}>2. Choose {pickup ? "Pickup" : "Delivery"} Time</Txt>
      <Txt style={{ fontSize: 12, color: palette.muted }}>{formatDeliveryDay(day, now)} · Philippine time</Txt>
      <View accessibilityRole="radiogroup" accessibilityLabel={pickup ? "Pickup time" : "Delivery time"} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {slots.map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={formatDeliveryTime(value)} accessibilityState={{ checked: selected === value }}
          onPress={() => { setChosen(value); setExactOpen(false); setExactError(null); setError(null); }}
          style={({ pressed }) => ({ width: "48%", flexGrow: 1, minHeight: 44, padding: 10, borderRadius: 10, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
            borderColor: selected === value ? palette.primary : palette.line, backgroundColor: selected === value || pressed ? palette.soft : "white" })}>
          {selected === value && <Check size={16} color={palette.primary} />}
          <Txt style={{ fontSize: 13, fontWeight: selected === value ? "600" : "400", color: selected === value ? palette.primary : palette.ink }}>{formatDeliveryTime(value)}</Txt>
        </Pressable>)}
      </View>
      {!loading && !slots.length && <Txt accessibilityRole="alert" style={styles.muted}>No {pickup ? "pickup" : "delivery"} times are available on this date. Choose another date.</Txt>}
      {!!slots.length && <Button title={exactOpen ? "Use suggested times" : "Enter an exact time"} compact outline onPress={() => { setExactOpen(value => !value); setExactError(null); }} />}
      {exactOpen && <View>
        <Field label={pickup ? "Exact pickup time" : "Exact delivery time"} placeholder="17:45 or 5:45 PM" value={exactTime} onChangeText={chooseExact} autoCapitalize="characters" />
        <FormError error={exactError || (chosen && !selected ? "That time is no longer available. Choose a later time." : null)} />
      </View>}
      <FormError error={error} />
    </ScrollView>
    <View testID="delivery-schedule-footer" style={{ flexShrink: 0, padding: 16, gap: 8, borderTopWidth: 1, borderTopColor: palette.line, backgroundColor: "white" }}>
      <Txt accessibilityLiveRegion="polite" style={{ fontSize: 12, color: palette.muted }}>{selected ? `Selected ${pickup ? "pickup request" : "delivery"}: ${formatDeliveryDay(day, now)} at ${formatDeliveryTime(selected)}` : `Select a ${pickup ? "pickup" : "delivery"} date and time`}</Txt>
      <Button title={pickup ? "Save pickup request" : "Confirm Delivery Schedule"} disabled={!selected || loading || !!fresh.error || !availability.isOpen} onPress={confirm} />
    </View>
  </KeyboardAvoidingView>;
  return embedded ? content : <Screen back={false} scroll={false} padded={false}>{content}</Screen>;
}
