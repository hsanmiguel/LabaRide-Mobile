import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import {
  Bell,
  ChevronRight,
  Clock,
  MapPin,
  Phone,
  Info,
  ShoppingBasket,
} from "lucide-react-native";
import { router } from "expo-router";
import { useAuthStore } from "../store/authStore";
import {
  Asset,
  Button,
  Card,
  Empty,
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
  go,
  message,
  useProfile,
  useShop,
  useShops,
  type Shop,
} from "./data";
import { useLaundryDraft } from "./store";
import LaundryMap from "./LaundryMap";

export function QueryState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: unknown;
  retry?: () => void;
}) {
  if (loading)
    return (
      <ActivityIndicator color={palette.blue} style={{ marginVertical: 24 }} />
    );
  if (error)
    return (
      <Empty
        title="Unable to load"
        message={message(error)}
        action="Retry"
        onPress={retry}
      />
    );
  return null;
}
export function ShopCard({
  shop,
  horizontal = false,
  onPress,
}: {
  shop: Shop;
  horizontal?: boolean;
  onPress?: () => void;
}) {
  const user = useAuthStore((state) => state.user);
  return (
    <Pressable
      onPress={
        onPress ||
        (() =>
          router.push({
            pathname: "/(user)/shops/[id]",
            params: { id: String(shop.id) },
          }))
      }
      style={horizontal ? { width: 220 } : undefined}
    >
      <Card style={horizontal ? { height: 110 } : { padding: 16 }}>
        <View style={styles.row}>
          {!horizontal && (
            <Asset
              name="lavanderaakoprfile.png"
              size={70}
              style={{ borderRadius: 12 }}
            />
          )}
          <View style={styles.grow}>
            <Txt
              style={{
                color: palette.navy,
                fontSize: horizontal ? 18 : 20,
                fontWeight: "700",
              }}
              numberOfLines={1}
            >
              {shop.shopName}
            </Txt>
            <Txt style={[styles.muted, { marginTop: 8 }]} numberOfLines={2}>
              {address(shop) || "Address not provided"}
            </Txt>
            {!horizontal && shop.userId === user?.id && (
              <Txt style={{ color: "#388E3C", fontSize: 12, marginTop: 8 }}>
                Your Shop
              </Txt>
            )}
          </View>
          {!horizontal && <ChevronRight size={20} color={palette.navy} />}
        </View>
      </Card>
    </Pressable>
  );
}
export function UserHomeDesign() {
  const shops = useShops();
  const profile = useProfile();
  const guest = useAuthStore((state) => state.isGuest);
  const user = useAuthStore((state) => state.user);
  const deliveryAddress = useLaundryDraft((state) => state.address);
  const location = address(deliveryAddress || profile.data);
  return (
    <Screen background="#1E54AB" padded={false} back={false}>
      <View style={{ padding: 16, gap: 16 }}>
        <View style={styles.between}>
          <Pressable
            onPress={() => go("add-location")}
            style={[styles.row, styles.grow]}
          >
            <MapPin size={24} color="white" />
            <Txt style={{ color: "white", flex: 1 }} numberOfLines={1}>
              {location ||
                (guest ? "Choose your location" : "Set your delivery address")}
            </Txt>
          </Pressable>
          {!guest && user && (
            <Pressable
              accessibilityLabel="Notifications"
              onPress={() => go("notifications")}
            >
              <Bell size={24} color="white" />
            </Pressable>
          )}
        </View>
        <SearchBox onPress={() => go("search")} />
        <Section title="Explore Laundry Shop" light />
        <Pressable
          onPress={() => go("map")}
          style={{ height: 150, borderRadius: 12, overflow: "hidden" }}
        >
          <Asset name="maps.png" style={{ width: "100%", height: "100%" }} />
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: "#00000066",
              padding: 16,
            }}
          >
            <Txt style={{ color: "white", fontSize: 16, fontWeight: "700" }}>
              View Map
            </Txt>
          </View>
        </Pressable>
        <QueryState
          loading={shops.isLoading}
          error={shops.error}
          retry={() => shops.refetch()}
        />
      </View>
      {["Laundry Shops", "Nearby Laundry Shops"].map((title) => (
        <View key={title} style={{ marginBottom: 24 }}>
          <View style={{ paddingHorizontal: 16 }}>
            <Section
              title={title}
              action="View All"
              light
              onPress={() => router.push("/(user)/shops")}
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 16, paddingHorizontal: 16 }}
          >
            {(shops.data || []).map((shop) => (
              <ShopCard key={shop.id} shop={shop} horizontal />
            ))}
            {shops.data?.length === 0 && (
              <Txt style={{ color: "white" }}>
                No laundry shops available yet.
              </Txt>
            )}
          </ScrollView>
        </View>
      ))}
    </Screen>
  );
}
export function ShopsDesign({
  search = false,
  map = false,
}: {
  search?: boolean;
  map?: boolean;
}) {
  const shops = useShops();
  const [query, setQuery] = useState("");
  const draft = useLaundryDraft();
  const filtered = (shops.data || []).filter((s) =>
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
    router.push({
      pathname: "/(user)/shops/[id]",
      params: { id: String(shop.id) },
    });
  }
  return (
    <Screen
      title={map ? "Laundry Shops" : search ? undefined : "All Laundry Shops"}
      dark={!search}
      background={map ? palette.surface : "white"}
      scroll={!map}
      right={
        !search && (
          <Pressable accessibilityLabel="View map" onPress={() => go("map")}>
            <MapPin color="white" size={24} />
          </Pressable>
        )
      }
    >
      <View style={styles.stack}>
        <View style={styles.row}>
          {search && (
            <Pressable onPress={() => router.back()}>
              <Asset name="backarrowblue.png" />
            </Pressable>
          )}
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
          <View style={{ height: 320, borderRadius: 12, overflow: "hidden" }}>
            <LaundryMap shops={filtered} onSelect={open} />
          </View>
        )}
        {search && !query && (
          <>
            <Section title="Search History" />
            {draft.searchHistory.length ? (
              draft.searchHistory.map((q) => (
                <Pressable
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
            title={search ? "No laundry shop matched" : "No laundry shops yet"}
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
  const result = useShop(id);
  const [tab, setTab] = useState("About");
  const shop = result.data;
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
          title="Open Shop"
          color={palette.navy}
          onPress={() =>
            router.push({
              pathname: "/(user)/order/[shopId]",
              params: { shopId: String(id) },
            })
          }
        />
      }
    >
      <View style={styles.stack}>
        <View style={{ alignItems: "center", gap: 12, padding: 16 }}>
          <Asset
            name="lavanderaakoprfile.png"
            size={112}
            style={{ borderRadius: 16 }}
          />
          <Txt style={styles.title}>{shop.shopName}</Txt>
          <Txt style={styles.muted}>Shop ID: {shop.id}</Txt>
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
              <Txt>Monday to Sunday</Txt>
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
                {money(service.price)} / kilo
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
  const result = useShop(id);
  const draft = useLaundryDraft();
  const shop = result.data;
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
            <Txt style={styles.muted}>Basket</Txt>
            <Txt style={styles.heading}>{money(service?.price)}</Txt>
          </View>
          <Button
            title="Basket"
            color={palette.navy}
            icon={<ShoppingBasket size={18} color="white" />}
            disabled={!service}
            onPress={() => {
              if (shop && service) {
                draft.start(shop, service);
                router.push({
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
        <View style={styles.between}>
          <Pressable accessibilityLabel="Back" onPress={() => router.back()}>
            <Asset name="circlebackarrow.png" size={40} />
          </Pressable>
          <Pressable
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
            <Pressable onPress={() => go("shop-about", { id: String(id) })}>
              <Card style={{ backgroundColor: "white" }}>
                <View style={styles.row}>
                  <Asset
                    name="lavanderaakoprfile.png"
                    size={60}
                    style={{ borderRadius: 12 }}
                  />
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
            {(shop.services || []).map((s, index) => {
              const colors = ["#98D8BF", "#64B5F6", "#BA68C8", "#FFB74D"];
              const color =
                s.color?.replace("0xFF", "#") || colors[index % colors.length];
              return (
                <Pressable
                  key={s.id}
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
                      backgroundColor: /^#[\da-f]{6}$/i.test(color)
                        ? color
                        : colors[index % colors.length],
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
                          <Txt style={{ color: "white", textAlign: "center" }}>
                            ✓
                          </Txt>
                        )}
                      </View>
                    </View>
                    <Txt style={{ color: palette.navy }}>
                      Standard laundering, folding.
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
                        {money(s.price)} per kilo
                      </Txt>
                    </View>
                  </Card>
                </Pressable>
              );
            })}
            {!shop.services?.length && <Empty title="No services available" />}
          </>
        )}
      </View>
    </Screen>
  );
}
