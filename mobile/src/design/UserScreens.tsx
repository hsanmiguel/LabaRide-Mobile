import { NotificationBell } from "./NotificationBell";
import { coordinates, nearestShops, nearbyShops } from "./discovery";
import { useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import {
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
  Heart,
} from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuthStore } from "../store/authStore";
import { emptyFavoriteIds, useShopFavoritesStore } from "./shop-favorites-store";
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
import { ShopLocationCard } from './ShopLocationCard';
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
  const user = useAuthStore(state => state.user);
  const owner = user ? `user:${user.id}` : "guest";
  const favorite = useShopFavoritesStore(state => (state.byOwner[owner] || []).includes(shop.id));
  const toggleFavorite = useShopFavoritesStore(state => state.toggle);
  const availability = shopAvailability(shop);
  const { width } = useWindowDimensions();
  return <View style={{ width: horizontal ? Math.min(296, width - 72) : undefined, position: "relative" }}>
    <Pressable accessibilityRole="button" accessibilityLabel={"View " + shop.shopName}
      onPress={onPress || (() => router.push({ pathname: "/(user)/shops/[id]", params: { id: String(shop.id) } }))}
      style={({ pressed }) => ({ opacity: pressed ? 0.86 : 1 })}>
    <Card style={{ padding: 10, gap: 0, borderRadius: 24 }}>
      <ShopPhoto name={shop.shopName} photoUrl={shop.photoUrl} style={{ width: "100%", height: 180, aspectRatio: undefined }} />
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
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={favorite ? `Remove ${shop.shopName} from favorites` : `Save ${shop.shopName} to favorites`}
      accessibilityState={{ selected: favorite }} onPress={() => toggleFavorite(owner, shop.id)}
      style={({ pressed }) => ({ position: "absolute", top: 18, right: 18, width: 44, height: 44, borderRadius: 22,
        alignItems: "center", justifyContent: "center", backgroundColor: pressed ? palette.soft : "white", opacity: pressed ? 0.85 : 1,
        borderWidth: 1, borderColor: favorite ? palette.dangerSoft : palette.line })}>
      <Heart size={21} color={favorite ? palette.danger : palette.primary} fill={favorite ? palette.danger : "transparent"} />
    </Pressable>
  </View>;
}
export function UserHomeDesign() {
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const shops = useShops();
  const profile = useProfile();
  const user = useAuthStore(state => state.user);
  const owner = user ? `user:${user.id}` : "guest";
  const favorites = useShopFavoritesStore(state => state.byOwner[owner] || emptyFavoriteIds);
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
  const displayed = filter === "nearby" ? nearby.map(item => item.shop) : filter === "favorites"
    ? (shops.data || []).filter(shop => favorites.includes(shop.id)) : shops.data || [];
  return <Screen back={false}>
    <View style={[styles.stack, { gap: 16 }]}>
      <View style={[styles.row, { alignItems: "flex-start", gap: width < 360 ? 8 : 16 }]}>
        <View style={styles.grow}>
          <Txt style={{ fontSize: width >= 768 ? 30 : 24, fontWeight: "700" }} numberOfLines={1}>{firstName ? `Hello, ${firstName}` : "Hello there"}</Txt>
          <Pressable accessibilityRole="button" accessibilityLabel="Choose delivery location" onPress={() => go("add-location")}
            style={[styles.row, { minHeight: 44, gap: 6, alignSelf: "flex-start", maxWidth: "100%" }]}>
            <MapPin size={14} color={palette.primary} style={{ flexShrink: 0 }} />
            <Txt numberOfLines={1} style={{ flexShrink: 1, minWidth: 0, color: palette.muted, fontSize: 12 }}>{location || "Choose your delivery location"}</Txt>
            <ChevronRight size={14} color={palette.primary} style={{ flexShrink: 0 }} />
          </Pressable>
        </View>
        <View style={[styles.row, { flexShrink: 0, gap: 8, paddingTop: 4 }]}>{user && <View ref={notificationBell} collapsable={false}>
          <IconButton label="Notifications" onPress={toggleNotifications}><NotificationBell size={22} color={palette.primary} /></IconButton>
        </View>}
        <IconButton label="Your profile" onPress={() => router.push("/(user)/profile")}><UserRound size={22} color={palette.primary} /></IconButton></View>
      </View>
      {notificationAnchor && user && <RecentNotificationsModal anchor={notificationAnchor} onClose={() => setNotificationAnchor(null)} />}
      <SearchBox onPress={() => go("search")} />
      <View style={{ gap: 12 }}>
        <Txt style={styles.heading}>Find your laundry care</Txt>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
          {[{ value: "all", label: "All shops" }, { value: "nearby", label: "Nearby" }, { value: "favorites", label: `Favorites${favorites.length ? ` · ${favorites.length}` : ""}` }].map(item =>
            <Pressable key={item.value} accessibilityRole="button" accessibilityState={{ selected: filter === item.value }} onPress={() => setFilter(item.value)}
              style={{ minHeight: 44, paddingHorizontal: 18, justifyContent: "center", borderRadius: 24, borderWidth: 1,
                borderColor: filter === item.value ? palette.primary : palette.line, backgroundColor: filter === item.value ? palette.primary : "white" }}>
              <Txt style={{ color: filter === item.value ? "white" : palette.muted, fontWeight: "500" }}>{item.label}</Txt>
            </Pressable>)}
        </ScrollView>
      </View>
      <QueryState loading={shops.isLoading} error={shops.error} retry={() => shops.refetch()} />
      {!shops.isLoading && !shops.error && <>
        <View testID="customer-shop-discovery"><Section title={filter === "nearby" ? "Closest to you" : filter === "favorites" ? "Your favorite shops" : "Laundry shops"} action="View all" onPress={() => router.push({ pathname: "/(user)/shops", params: filter === "nearby" ? { nearby: "true" } : filter === "favorites" ? { favorites: "true" } : {} })} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 4 }}>
            {displayed.slice(0, 8).map(shop => <ShopCard key={shop.id} shop={shop} horizontal
              distance={filter === "nearby" ? nearby.find(item => item.shop.id === shop.id)?.distance : undefined} />)}
          </ScrollView>
          {!displayed.length && <Empty title={!shops.data?.length ? "No shops available yet" : "No matching shops"}
            message={filter === "favorites" ? "Tap the heart on a shop to save it for quick access." : filter === "nearby" && !point ? "Save a position with your delivery address to discover nearby shops." : "Try another laundry service or browse all shops."}
            action={filter === "favorites" ? "Browse all shops" : filter === "nearby" && !point ? "Choose location" : undefined}
            onPress={() => filter === "favorites" ? setFilter("all") : go("add-location")} />}
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
  const { width } = useWindowDimensions();
  const webMap = map && Platform.OS === "web";
  const [resultsWidth, setResultsWidth] = useState(0);
  const resultColumns = resultsWidth >= 960 ? 3 : resultsWidth >= 600 ? 2 : 1;
  const { go: openFlow, inShop } = useFlowNavigation();
  const shops = useShops();
  const [query, setQuery] = useState("");
  const draft = useLaundryDraft();
  const { nearby, favorites: favoritesParam } = useLocalSearchParams<{ nearby?: string; favorites?: string }>();
  const [discoveryFilter, setDiscoveryFilter] = useState<"all" | "nearby" | "favorites">(nearby === "true" ? "nearby" : favoritesParam === "true" ? "favorites" : "all");
  const user = useAuthStore(state => state.user);
  const owner = user ? `user:${user.id}` : "guest";
  const favorites = useShopFavoritesStore(state => state.byOwner[owner] || emptyFavoriteIds);
  const profile = useProfile();
  const point = coordinates(draft.address || profile.data);
  const nearest = nearbyShops(shops.data || [], draft.address || profile.data);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const searched = (shops.data || []).filter(shop => [shop.shopName, address(shop), ...(shop.services || []).map(service => service.serviceName)]
    .some(value => String(value || "").toLocaleLowerCase().includes(normalizedQuery)));
  const filtered = (discoveryFilter === "nearby" ? nearest.map(item => item.shop)
    : discoveryFilter === "favorites" ? searched.filter(shop => favorites.includes(shop.id)) : searched)
    .filter(shop => !normalizedQuery || [shop.shopName, address(shop), ...(shop.services || []).map(service => service.serviceName)]
      .some(value => String(value || "").toLocaleLowerCase().includes(normalizedQuery)));
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
      title={map ? "Explore the map" : search ? "Find a laundry shop" : discoveryFilter === "favorites" ? "Favorite laundry shops" : discoveryFilter === "nearby" ? "Nearby laundry shops" : "All laundry shops"}
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
        <TabsRow items={["All shops", "Nearby", `Favorites${favorites.length ? ` (${favorites.length})` : ""}`]}
          value={discoveryFilter === "all" ? "All shops" : discoveryFilter === "nearby" ? "Nearby" : `Favorites${favorites.length ? ` (${favorites.length})` : ""}`}
          onChange={value => setDiscoveryFilter(value === "Nearby" ? "nearby" : value.startsWith("Favorites") ? "favorites" : "all")} />
        {map && (
          <View style={{ height: webMap && width >= 1000 ? 380 : 300, flexShrink: 0, borderRadius: 16, overflow: "hidden" }}>
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
        {!shops.isLoading && !shops.error && <Txt accessibilityLiveRegion="polite" style={styles.muted}>{filtered.length} {filtered.length === 1 ? "shop" : "shops"}{normalizedQuery ? ` matching “${query.trim()}”` : ""}</Txt>}
        {webMap ? (
          <View style={{ gap: 16 }}>
            <Txt accessibilityRole="header" style={styles.heading}>{filtered.length} {filtered.length === 1 ? "laundry shop" : "laundry shops"}</Txt>
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: 16 }}>
              {filtered.map(shop => <View key={shop.id} style={{ width: width >= 1400 ? "31.8%" : width >= 1000 ? "48.8%" : "100%", minWidth: 0 }}>
                <ShopCard shop={shop} onPress={() => open(shop)} />
              </View>)}
            </View>
          </View>
        ) : map ? (
          <ScrollView
            style={{ maxHeight: 260 }}
            contentContainerStyle={styles.stack}
          >
            {filtered.map((shop) => (
              <ShopCard key={shop.id} shop={shop} onPress={() => open(shop)} />
            ))}
          </ScrollView>
        ) : (
          <View
            onLayout={({ nativeEvent }) => setResultsWidth(nativeEvent.layout.width)}
            style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: 16 }}
          >
            {filtered.map((shop) => (
              <View key={shop.id} style={{ width: resultsWidth ? (resultsWidth - 16 * (resultColumns - 1)) / resultColumns : "100%", minWidth: 0 }}>
                <ShopCard shop={shop} onPress={() => open(shop)} />
              </View>
            ))}
          </View>
        )}
        {!shops.isLoading && !shops.error && !filtered.length && (
          <Empty
            title={query ? "No laundry shops matched" : discoveryFilter === "favorites" ? "No favorite shops yet" : discoveryFilter === "nearby" ? "No nearby shops to show" : "No laundry shops yet"}
            message={discoveryFilter === "favorites" && !query ? "Tap the heart on a shop to save it here for quick access." : discoveryFilter === "nearby" ? "Save a current position with your address to find shops with map locations." : "Try a shop name, service, or area."}
            action={discoveryFilter === "favorites" && !query ? "Browse all shops" : undefined}
            onPress={discoveryFilter === "favorites" && !query ? () => setDiscoveryFilter("all") : undefined}
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
  const { width } = useWindowDimensions();
  const desktop = width >= 1000;
  const { go: openFlow, inShop } = useFlowNavigation();
  const result = useShop(id);
  const shop = result.data;
  const availability = useShopAvailability(shop);
  const draft = useLaundryDraft();
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
          style={desktop ? { alignSelf: 'flex-end', minWidth: 240 } : undefined}
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
      <View testID="shop-information" style={[styles.stack, { gap: desktop ? 28 : 20 }]}>
        <View style={{ flexDirection: desktop ? 'row' : 'column', alignItems: desktop ? 'center' : 'stretch', gap: desktop ? 32 : 20 }}>
        <ShopPhoto name={shop.shopName} photoUrl={shop.photoUrl} style={desktop ? { width: '40%', height: 300, aspectRatio: undefined, flexShrink: 0 } : { width: '100%', maxHeight: 280 }} />
        <View style={{ flex: desktop ? 1 : undefined, minWidth: 0, gap: 12, paddingVertical: 8 }}>
          <Txt style={styles.title}>{shop.shopName}</Txt>
          <Txt style={{ color: availability.isOpen ? palette.primary : palette.muted }}>{availability.message}</Txt>
          <Txt style={styles.muted}>Delivery area: {serviceAreaLabel(shop, "delivery")}</Txt>
          <Txt style={styles.muted}>{shop.pickupEnabled ? `Laundry collection area: ${serviceAreaLabel(shop, "pickup")}` : "Laundry collection is not offered"}</Txt>
          <Txt style={{ color: palette.muted, fontSize: 12 }}>Service areas use straight-line distance from the shop. Collecting finished laundry at the shop has no distance limit.</Txt>
        </View>
        </View>
        <View style={{ flexDirection: desktop ? 'row' : 'column', alignItems: 'stretch', gap: 16 }}>
            <Card style={{ flex: desktop ? 1 : undefined, minWidth: 0 }}>
              <View style={styles.row}>
                <Clock color={palette.navy} size={22} />
                <Txt style={styles.heading}>Business Hours</Txt>
              </View>

              <Txt style={styles.muted}>
                {shop.openingTime || "—"} – {shop.closingTime || "—"}
              </Txt>
            </Card>
            <Card style={{ flex: desktop ? 1 : undefined, minWidth: 0 }}>
              <View style={styles.row}>
                <Phone color={palette.navy} size={22} />
                <Txt style={styles.heading}>Contact Information</Txt>
              </View>
              <Txt>{shop.contactNumber || "Not provided"}</Txt>
            </Card>
        </View>
        <ShopLocationCard shop={shop} />
        <Section title="Services & prices" />
        <View style={{ flexDirection: desktop ? 'row' : 'column', flexWrap: 'wrap', gap: 16 }}>
        {(shop.services || []).map((service) => (
          <Card key={service.id} style={{ flexGrow: 1, flexBasis: desktop ? '47%' : undefined, minWidth: 0 }}>
            <View style={[styles.between, { gap: 12 }]}>
              <Txt style={{ flex: 1, fontWeight: "600", color: palette.navy }}>
                {service.serviceName}
              </Txt>
              <Txt style={{ color: palette.navy }}>
                {servicePriceLabel(service)}
              </Txt>
            </View>
            <Button
              title={availability.isOpen ? "Place order" : "Shop closed"}
              compact
              disabled={!availability.isOpen}
              onPress={() => {
                if (!shop || !shopAvailability(shop).isOpen) return;
                if (!useAuthStore.getState().user) {
                  router.push({ pathname: "/(auth)/login", params: { returnShopId: String(id) } });
                  return;
                }
                draft.start(shop, service, [service.id]);
                if (inShop) openFlow("order-summary", { id: String(id) });
                else router.push({ pathname: "/(user)/order/confirm", params: { shopId: String(id) } });
              }}
            />
          </Card>
        ))}
        </View>
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
  const [selected, setSelected] = useState<number | null>(() => draft.shop?.id === id ? draft.service?.id ?? null : null);
  const service = shop?.services?.find(item => item.id === selected);
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
                ? service.packageKilos != null ? `${money(service.price)}/load` : shop?.kiloPrices?.length ? "Based on weight" : `${money(service.price)}/kg`
                : money(0)}
            </Txt>
          </View>
          <Button
            title={availability.isOpen ? "Place order" : shop?.acceptingOrders === false ? "Orders paused" : "Shop closed"}
            color={palette.navy}
            icon={<ShoppingBasket size={18} color="white" />}
            disabled={!service || !availability.isOpen}
            onPress={() => {
              if (shop && service && shopAvailability(shop).isOpen) {
                if (!useAuthStore.getState().user) {
                  router.push({ pathname: "/(auth)/login", params: { returnShopId: String(id) } });
                  return;
                }
                draft.start(shop, service, [service.id]);
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
                    {!availability.isOpen && <Txt style={{ color: palette.muted, fontSize: 12 }}>{availability.message}</Txt>}
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
            <View testID="shop-service-options" accessibilityRole="radiogroup" accessibilityLabel="Choose one laundry service" style={{ gap: 16 }}>
            <Txt style={{ fontSize: 13, color: palette.muted }}>Choose one service for this order. Pickup and delivery options are available in the order summary.</Txt>
            {(shop.services || []).map((s) => {

              return (
                <Pressable accessibilityRole="radio"
                  key={s.id}
                  accessibilityLabel={`${s.serviceName}, ${servicePriceLabel(s)}`}
                  accessibilityState={{ checked: selected === s.id }}
                  aria-checked={selected === s.id}
                  onPress={() => setSelected(s.id)}
                >
                  <Card
                    style={{
                      backgroundColor: selected === s.id ? palette.soft : "white",
                      borderWidth: 2,
                      borderColor: selected === s.id
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
                          borderRadius: 12,
                          borderWidth: 2,
                          borderColor: palette.navy,
                          alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        {selected === s.id && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: palette.primary }} />}
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
            </View>
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
