import { coordinates, nearestShops, nearbyShops } from "./discovery";
import { useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import {
  Bell,
  ArrowUpRight,
  UserRound,
  Store,
  Check,
  ChevronRight,
  Clock,
  MapPin,
  Phone,
  Info,
  ShoppingBasket,
} from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuthStore } from "../store/authStore";
import {
  Asset,
  IconButton,
  Button,
  Card,
  Empty,
  PriceRow,
  Screen,
  SearchBox,
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
  go,
  message,
  useProfile,
  useShop,
  useShops,
  useFlowNavigation,
  type Shop,
} from "./data";
import { useLaundryDraft } from "./store";
import LaundryMap from "./LaundryMap";
import { ShopPhoto } from "./ShopPhoto";
import { RecentNotificationsModal } from "./RecentNotificationsModal";
import { serviceAreaLabel } from "./service-area";
import { shopAvailability } from "./shop-hours";
import { useShopAvailability } from "./useShopAvailability";

export function QueryState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: unknown;
  retry?: () => void;
}) {
  const palette = usePalette();
  if (loading)
    return (
      <ActivityIndicator accessibilityLabel="Loading, please wait" color={palette.blue} style={{ marginVertical: 24 }} />
    );
  if (error)
    return (
      <View accessibilityRole="alert" accessibilityLiveRegion="polite"><Empty
        title="Unable to load"
        message={message(error)}
        action="Retry"
        onPress={retry}
      /></View>
    );
  return null;
}
export function ShopCard({ shop, horizontal = false, onPress, distance }: {
  shop: Shop; horizontal?: boolean; onPress?: () => void; distance?: number;
}) {
  const palette = usePalette();
  const availability = shopAvailability(shop);
  const { width } = useWindowDimensions();
  return <Pressable accessibilityRole="button" accessibilityLabel={"View " + shop.shopName}
    onPress={onPress || (() => router.push({ pathname: "/(user)/shops/[id]", params: { id: String(shop.id) } }))}
    style={({ pressed }) => ({ width: horizontal ? Math.min(296, width - 72) : undefined, opacity: pressed ? 0.86 : 1 })}>
    <Card style={{ padding: 10, gap: 0, borderRadius: 24 }}>
      <ShopPhoto name={shop.shopName} photoUrl={shop.photoUrl} />
      <View style={{ padding: 8, paddingTop: 16, gap: 10 }}>
        <Txt numberOfLines={2} style={{ fontSize: 18, fontWeight: "700" }}>{shop.shopName}</Txt>
        <Txt style={{ fontSize: 12, fontWeight: "600", color: availability.isOpen ? palette.primary : palette.muted }}>{availability.label}</Txt>
        <View style={[styles.row, { alignItems: "flex-start", gap: 6 }]}>
          <MapPin size={14} color={palette.muted} />
          <Txt numberOfLines={2} style={{ flex: 1, fontSize: 12, lineHeight: 18, color: palette.muted }}>{address(shop) || "Address not provided"}</Txt>
        </View>
        {!!shop.openingTime && !!shop.closingTime && <View style={[styles.row, { gap: 6 }]}>
          <Clock size={14} color={palette.muted} /><Txt style={{ color: palette.muted, fontSize: 12 }}>{shop.openingTime} – {shop.closingTime}</Txt>
        </View>}
        <View style={[styles.row, { justifyContent: "space-between", marginTop: 2 }]}>
          <View style={styles.grow}>
            {distance != null ? <><Txt style={{ color: palette.primary, fontWeight: "600" }}>{distance.toFixed(1)} km away</Txt><Txt style={{ fontSize: 11, color: palette.muted }}>Straight-line distance</Txt></>
              : shop.services?.length ? <><Txt numberOfLines={1} style={{ color: palette.muted, fontSize: 11 }}>{shop.services[0].serviceName}</Txt><Txt numberOfLines={2} style={{ fontWeight: "600", color: palette.primary, fontSize: 12 }}>{servicePriceLabel(shop.services[0])}</Txt></>
              : <Txt style={{ fontWeight: "600", color: palette.primary }}>Explore shop</Txt>}
          </View>
          <View pointerEvents="none" style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center" }}>
            <ArrowUpRight size={20} color="white" />
          </View>
        </View>
      </View>
    </Card>
  </Pressable>;
}
export function UserHomeDesign() {
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const shops = useShops();
  const profile = useProfile();
  const guest = useAuthStore(state => state.isGuest);
  const user = useAuthStore(state => state.user);
  const deliveryAddress = useLaundryDraft(state => state.address);
  const selectedAddress = deliveryAddress || profile.data;
  const location = address(selectedAddress);
  const nearby = nearbyShops(shops.data || [], selectedAddress);
  const point = coordinates(selectedAddress);
  const [filter, setFilter] = useState("all");
  const notificationBell = useRef<View>(null);
  const [notificationAnchor, setNotificationAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const toggleNotifications = () => {
    if (Platform.OS !== "web") {
      go("notifications");
      return;
    }
    if (notificationAnchor) {
      setNotificationAnchor(null);
      return;
    }
    notificationBell.current?.measureInWindow((x, y, width, height) => {
      setNotificationAnchor({ x, y, width, height });
    });
  };
  const firstName = (profile.data?.name || user?.name || "").trim().split(/\s+/)[0];
  const serviceFilters = Array.from(new Set((shops.data || []).flatMap(shop => (shop.services || []).map(service => service.serviceName)))).slice(0, 4);
  const displayed = filter === "nearby" ? nearby.map(item => item.shop) :
    (shops.data || []).filter(shop => filter === "all" || shop.services?.some(service => `service:${service.serviceName}` === filter));
  return <Screen back={false}>
    <View style={[styles.stack, { gap: 16 }]}>
      <View style={styles.between}>
        <View style={styles.grow}>
          <Txt style={{ fontSize: width >= 768 ? 30 : 24, fontWeight: "700" }} numberOfLines={1}>{firstName ? `Hello, ${firstName}` : "Hello there"}</Txt>
          <Pressable accessibilityRole="button" accessibilityLabel="Choose delivery location" onPress={() => go("add-location")}
            style={[styles.row, { minHeight: 36, gap: 6, alignSelf: "flex-start", maxWidth: "100%" }]}>
            <MapPin size={14} color={palette.primary} />
            <Txt numberOfLines={1} style={{ flexShrink: 1, minWidth: 0, color: palette.muted, fontSize: 12 }}>{location || "Choose your delivery location"}</Txt>
            <ChevronRight size={14} color={palette.primary} />
          </Pressable>
        </View>
        {!guest && user && <View ref={notificationBell} collapsable={false}>
          <IconButton label="Notifications" onPress={toggleNotifications}><Bell size={22} color={palette.primary} /></IconButton>
        </View>}
        <IconButton label="Your profile" onPress={() => router.push("/(user)/profile")}><UserRound size={22} color={palette.primary} /></IconButton>
      </View>
      {notificationAnchor && !guest && user && <RecentNotificationsModal anchor={notificationAnchor} onClose={() => setNotificationAnchor(null)} />}
      <SearchBox onPress={() => go("search")} />
      <View style={{ gap: 12 }}>
        <Txt style={styles.heading}>Find your laundry care</Txt>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
          {[{ value: "all", label: "All shops" }, { value: "nearby", label: "Nearby" }, ...serviceFilters.map(name => ({ value: `service:${name}`, label: name }))].map(item =>
            <Pressable key={item.value} accessibilityRole="button" accessibilityState={{ selected: filter === item.value }} onPress={() => setFilter(item.value)}
              style={{ minHeight: 44, paddingHorizontal: 18, justifyContent: "center", borderRadius: 24, borderWidth: 1,
                borderColor: filter === item.value ? palette.primary : palette.line, backgroundColor: filter === item.value ? palette.primary : "white" }}>
              <Txt style={{ color: filter === item.value ? "white" : palette.muted, fontWeight: "500" }}>{item.label}</Txt>
            </Pressable>)}
        </ScrollView>
      </View>
      <QueryState loading={shops.isLoading} error={shops.error} retry={() => shops.refetch()} />
      {!shops.isLoading && !shops.error && <>
        <View testID="customer-shop-discovery"><Section title={filter === "nearby" ? "Closest to you" : "Laundry shops"} action="View all" onPress={() => router.push({ pathname: "/(user)/shops", params: filter === "nearby" ? { nearby: "true" } : {} })} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 4 }}>
            {displayed.slice(0, 8).map(shop => <ShopCard key={shop.id} shop={shop} horizontal
              distance={filter === "nearby" ? nearby.find(item => item.shop.id === shop.id)?.distance : undefined} />)}
          </ScrollView>
          {!displayed.length && <Empty title={!shops.data?.length ? "No shops available yet" : "No matching shops"}
            message={filter === "nearby" && !point ? "Save a position with your delivery address to discover nearby shops." : "Try another laundry service or browse all shops."}
            action={filter === "nearby" && !point ? "Choose location" : undefined} onPress={() => go("add-location")} />}
        </View>
        <View><Section title="Nearby laundry shops" action="View all" onPress={() => router.push({ pathname: "/(user)/shops", params: { nearby: "true" } })} />
          <Txt style={[styles.muted, { marginBottom: 16 }]}>{point ? "Closest to your selected location" : "Set a pinned location to find shops closest to you."}</Txt>
          {nearby.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 4 }}>
            {nearby.slice(0, 6).map(({ shop, distance }) => <ShopCard key={shop.id} shop={shop} distance={distance} horizontal />)}
          </ScrollView> : <Card><Empty title={point ? "No shops with a location yet" : "Find laundry near you"}
            message={point ? "Shops need a saved map location to appear here." : "Choose your address and save your current position."}
            action={!point ? "Choose location" : undefined} onPress={() => go("add-location")} /></Card>}
        </View>
      </>}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 8 }}><Section title="Explore the neighborhood" action="View map" onPress={() => go("map")} /></View>
        <View style={{ height: width >= 768 ? 240 : 220 }}><LaundryMap shops={shops.data || []} latitude={point?.latitude} longitude={point?.longitude}
          onSelect={shop => router.push({ pathname: "/(user)/shops/[id]", params: { id: String(shop.id) } })} /></View>
      </Card>
    </View>
  </Screen>;
}
export function ShopsDesign({
  search = false,
  map = false,
}: {
  search?: boolean;
  map?: boolean;
}) {
  const palette = usePalette();
  const { go: openFlow, inShop } = useFlowNavigation();
  const shops = useShops();
  const [query, setQuery] = useState("");
  const draft = useLaundryDraft();
  const { nearby } = useLocalSearchParams<{ nearby?: string }>();
  const profile = useProfile();
  const point = coordinates(draft.address || profile.data);
  const nearest = nearbyShops(shops.data || [], draft.address || profile.data);
  const filtered = (nearby === "true" ? nearest.map(item => item.shop) : shops.data || []).filter((s) =>
    `${s.shopName} ${address(s)}`.toLowerCase().includes(query.toLowerCase()),
  );
  function open(shop: Shop) {
    if (query.trim())
      draft.set({
        searchHistory: [
          query.trim(),
          ...draft.searchHistory.filter((s) => s !== query.trim()),
        ].slice(0, 8),
      });
    if (inShop) return openFlow("shop-information", { id: String(shop.id) });
    router.push({
      pathname: "/(user)/shops/[id]",
      params: { id: String(shop.id) },
    });
  }
  return (
    <Screen
      title={map ? "Explore the map" : search ? "Find a laundry shop" : nearby === "true" ? "Nearby laundry shops" : "All laundry shops"}
      dark={false}
      background={map ? palette.surface : "white"}
      scroll
      right={
        !search && !map && (
          <Pressable accessibilityRole="button" accessibilityLabel="View map" onPress={() => openFlow("map")}>
            <MapPin color={palette.primary} size={24} />
          </Pressable>
        )
      }
    >
      <View style={styles.stack}>
        <View style={styles.row}>

          <View style={styles.grow}>
            <SearchBox
              value={query}
              onChangeText={setQuery}
              placeholder={
                map ? "Type laundry shop name" : "Search for laundry shop"
              }
            />
          </View>
        </View>
        {map && (
          <View style={{ height: 300, borderRadius: 16, overflow: "hidden" }}>
            <LaundryMap shops={filtered} latitude={point?.latitude} longitude={point?.longitude} onSelect={open} />
          </View>
        )}
        {search && !query && (
          <>
            <Section title="Search History" />
            {draft.searchHistory.length ? (
              draft.searchHistory.map((q) => (
                <Pressable accessibilityRole="button"
                  key={q}
                  onPress={() => setQuery(q)}
                  style={styles.row}
                >
                  <Clock size={18} color="#9CA3AF" />
                  <Txt>{q}</Txt>
                </Pressable>
              ))
            ) : (
              <Txt style={styles.muted}>No search history yet</Txt>
            )}
          </>
        )}
        <QueryState
          loading={shops.isLoading}
          error={shops.error}
          retry={() => shops.refetch()}
        />
        {map ? (
          <ScrollView
            style={{ maxHeight: 260 }}
            contentContainerStyle={styles.stack}
          >
            {filtered.map((shop) => (
              <ShopCard key={shop.id} shop={shop} onPress={() => open(shop)} />
            ))}
          </ScrollView>
        ) : (
          filtered.map((shop) => (
            <ShopCard key={shop.id} shop={shop} onPress={() => open(shop)} />
          ))
        )}
        {!shops.isLoading && !shops.error && !filtered.length && (
          <Empty
            title={query ? "No laundry shops matched" : nearby === "true" ? "No nearby shops to show" : "No laundry shops yet"}
            message={nearby === "true" ? "Save a current position with your address to find shops with map locations." : "Try a different shop name or location."}
          />
        )}
      </View>
    </Screen>
  );
}
export function ShopInfoDesign({
  id,
  about = false,
}: {
  id: number;
  about?: boolean;
}) {
  const palette = usePalette();
  const { go: openFlow, inShop } = useFlowNavigation();
  const result = useShop(id);
  const [tab, setTab] = useState("About");
  const shop = result.data;
  const availability = useShopAvailability(shop);
  if (!shop)
    return (
      <Screen title="Shop Information">
        <QueryState
          loading={result.isLoading}
          error={result.error}
          retry={() => result.refetch()}
        />
        {!result.isLoading && !result.error && <Empty title="Shop not found" />}
      </Screen>
    );
  return (
    <Screen
      title={about ? shop.shopName : "Shop Information"}
      footer={
        <Button
          title="Browse services"
          color={palette.navy}
          onPress={() =>
            inShop ? openFlow("shop-menu", { id: String(id) }) : router.push({
              pathname: "/(user)/order/[shopId]",
              params: { shopId: String(id) },
            })
          }
        />
      }
    >
      <View style={styles.stack}>
        <ShopPhoto name={shop.shopName} photoUrl={shop.photoUrl} style={{ maxHeight: 360 }} />
        <View style={{ gap: 8, paddingVertical: 8 }}>
          <Txt style={styles.title}>{shop.shopName}</Txt>
          <Txt style={styles.muted}>Shop ID: {shop.id}</Txt>
          <Txt style={{ color: availability.isOpen ? palette.primary : palette.muted }}>{availability.message}</Txt>
          <Txt style={styles.muted}>Delivery area: {serviceAreaLabel(shop, "delivery")}</Txt>
          <Txt style={styles.muted}>{shop.pickupEnabled ? `Laundry collection area: ${serviceAreaLabel(shop, "pickup")}` : "Laundry collection is not offered"}</Txt>
          <Txt style={{ color: palette.muted, fontSize: 12 }}>Service areas use straight-line distance from the shop. Collecting finished laundry at the shop has no distance limit.</Txt>
        </View>
        {about && (
          <TabsRow
            items={["About", "Pricing"]}
            value={tab}
            onChange={setTab}
            color={palette.navy}
          />
        )}
        {tab === "About" && (
          <>
            <Card>
              <View style={styles.row}>
                <Clock color={palette.navy} size={22} />
                <Txt style={styles.heading}>Business Hours</Txt>
              </View>

              <Txt style={styles.muted}>
                {shop.openingTime || "—"} – {shop.closingTime || "—"}
              </Txt>
            </Card>
            <Card>
              <View style={styles.row}>
                <Phone color={palette.navy} size={22} />
                <Txt style={styles.heading}>Contact Information</Txt>
              </View>
              <Txt>{shop.contactNumber || "Not provided"}</Txt>
            </Card>
            <Card>
              <View style={styles.row}>
                <MapPin color={palette.navy} size={22} />
                <Txt style={styles.heading}>Address</Txt>
              </View>
              <Txt style={styles.muted}>{address(shop)}</Txt>
            </Card>
          </>
        )}
        <Section title={tab === "Pricing" ? "Pricing" : "Services"} />
        {(shop.services || []).map((service) => (
          <Card key={service.id}>
            <View style={styles.between}>
              <Txt style={{ fontWeight: "600", color: palette.navy }}>
                {service.serviceName}
              </Txt>
              <Txt style={{ color: palette.navy }}>
                {servicePriceLabel(service)}
              </Txt>
            </View>
          </Card>
        ))}
        {!shop.services?.length && (
          <Txt style={styles.muted}>No services listed yet.</Txt>
        )}
      </View>
    </Screen>
  );
}
export function ShopMenuDesign({ id }: { id: number }) {
  const palette = usePalette();
  const { go: openFlow, inShop } = useFlowNavigation();
  const result = useShop(id);
  const draft = useLaundryDraft();
  const shop = result.data;
  const availability = useShopAvailability(shop);
  const [selected, setSelected] = useState<number[]>([]);
  const chosen = (shop?.services || []).filter((s) => selected.includes(s.id));
  const service = chosen.length
    ? {
        ...chosen[0],
        serviceName: chosen.map((s) => s.serviceName).join(", "),
        price: chosen.reduce((sum, s) => sum + Number(s.price), 0),
      }
    : undefined;
  return (
    <Screen
      background={palette.surface}
      title=""
      footer={
        <View style={styles.between}>
          <View>
            <Txt style={styles.muted}>{service ? "Laundry rate" : "Basket"}</Txt>
            <Txt style={styles.heading}>
              {service
                ? chosen.length === 1 && chosen[0].packageKilos != null ? `${money(chosen[0].price)}/load` : chosen.some((item) => item.packageKilos != null) || shop?.kiloPrices?.length ? "Based on weight" : `${money(service.price)}/kg`
                : money(0)}
            </Txt>
          </View>
          <Button
            title={availability.isOpen ? "Review Order" : "Shop closed"}
            color={palette.navy}
            icon={<ShoppingBasket size={18} color="white" />}
            disabled={!service || !availability.isOpen}
            onPress={() => {
              if (shop && service && shopAvailability(shop).isOpen) {
                draft.start(shop, service, chosen.map((selectedService) => selectedService.id));
                if (inShop) openFlow("order-summary", { id: String(id) });
                else router.push({
                  pathname: "/(user)/order/confirm",
                  params: { shopId: String(id) },
                });
              }
            }}
          />
        </View>
      }
    >
      <View style={styles.stack}>
        {!availability.isOpen && <Txt accessibilityRole="alert" style={styles.muted}>{availability.message}</Txt>}
        <View style={styles.between}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()}>
            <Asset name="circlebackarrow.png" size={40} />
          </Pressable>
          <Pressable accessibilityRole="button"
            onPress={() =>
              draft.set({
                deliveryType:
                  draft.deliveryType === "Deliver" ? "Pickup" : "Deliver",
              })
            }
            style={{
              backgroundColor: "white",
              borderWidth: 1,
              borderColor: palette.navy,
              borderRadius: 24,
              paddingHorizontal: 16,
              paddingVertical: 8,
            }}
          >
            <View style={styles.row}>
              <Txt style={{ color: palette.navy }}>{draft.deliveryType}</Txt>
              <Asset name="downarrow.png" size={16} />
            </View>
          </Pressable>
        </View>
        <QueryState
          loading={result.isLoading}
          error={result.error}
          retry={() => result.refetch()}
        />
        {shop && (
          <>
            <Pressable accessibilityRole="button" onPress={() => openFlow("shop-about", { id: String(id) })}>
              <Card style={{ backgroundColor: "white" }}>
                <View style={styles.row}>
                  <View style={{ padding: 20, backgroundColor: palette.soft, borderRadius: 16 }}><Store size={32} color={palette.primary} /></View>
                  <View style={styles.grow}>
                    <Txt style={styles.heading}>{shop.shopName}</Txt>
                    <Txt style={styles.muted}>ID: {shop.id}</Txt>
                    <Txt style={styles.muted}>{address(shop)}</Txt>
                    <Txt style={[styles.muted, { fontSize: 12 }]}>
                      Business Hours: {shop.openingTime || "—"} –{" "}
                      {shop.closingTime || "—"}
                    </Txt>
                  </View>
                  <Info size={20} color={palette.navy} />
                </View>
              </Card>
            </Pressable>
            {(shop.services || []).map((s) => {

              return (
                <Pressable accessibilityRole="checkbox"
                  key={s.id}
                  accessibilityLabel={`${s.serviceName}, ${servicePriceLabel(s)}`}
                  accessibilityState={{ checked: selected.includes(s.id) }}
                  onPress={() =>
                    setSelected(
                      selected.includes(s.id)
                        ? selected.filter((id) => id !== s.id)
                        : [...selected, s.id],
                    )
                  }
                >
                  <Card
                    style={{
                      backgroundColor: selected.includes(s.id) ? palette.soft : "white",
                      borderWidth: 2,
                      borderColor: selected.includes(s.id)
                        ? palette.navy
                        : "transparent",
                      padding: 20,
                    }}
                  >
                    <View style={styles.between}>
                      <Txt
                        style={{
                          fontSize: 22,
                          fontWeight: "700",
                          color: palette.navy,
                        }}
                      >
                        {s.serviceName}
                      </Txt>
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 4,
                          borderWidth: 2,
                          borderColor: palette.navy,
                          backgroundColor: selected.includes(s.id)
                            ? palette.navy
                            : "transparent",
                        }}
                      >
                        {selected.includes(s.id) && (
                          <Check color="white" size={20} />
                        )}
                      </View>
                    </View>
                    <Txt style={{ color: palette.navy }}>
                      {s.packageKilos != null ? "Fixed price per load" : "Priced by laundry weight"}
                    </Txt>
                    <View
                      style={{
                        alignSelf: "flex-start",
                        borderRadius: 18,
                        backgroundColor: "white",
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        marginTop: 8,
                      }}
                    >
                      <Txt style={{ color: palette.navy, fontWeight: "600" }}>
                        {servicePriceLabel(s)}
                      </Txt>
                    </View>
                  </Card>
                </Pressable>
              );
            })}
            {!!shop.kiloPrices?.length && (
              <Card>
                <Txt style={styles.heading}>Weight prices</Txt>
                {shop.kiloPrices.map((range) => (
                  <PriceRow
                    key={range.id}
                    label={`${range.minKilo}–${range.maxKilo} kg`}
                    value={`${money(range.pricePerKilo)}/kg`}
                  />
                ))}
              </Card>
            )}
            {!shop.services?.length && <Empty title="No services available" />}
          </>
        )}
      </View>
    </Screen>
  );
}
