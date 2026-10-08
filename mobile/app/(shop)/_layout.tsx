import { useEffect } from "react";
import { Tabs, useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Asset, palette } from "../../src/design/ui";
import { useOwnedShop } from "../../src/design/data";
import { socketService } from "../../src/services/socket.service";
export default function ShopTabs() {
  const insets = useSafeAreaInsets();
  const segments = useSegments() as string[];
  const hideTabs = segments.some((s) =>
    ["order", "orders", "shops"].includes(s),
  );
  const owned = useOwnedShop();
  useEffect(() => {
    if (owned.data) socketService.joinShopRoom(owned.data.id);
  }, [owned.data?.id]);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.navy,
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarLabelStyle: { fontFamily: "Inter-Medium", fontSize: 11 },
        tabBarStyle: {
          display: hideTabs ? "none" : "flex",
          backgroundColor: "white",
          height: 64 + insets.bottom,
          paddingTop: 10,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <Asset name="OrderScreenIcon/Home.png" tint={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Orders",
          tabBarIcon: ({ color }) => (
            <Asset name="OrderScreenIcon/Orders.png" tint={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: "Services",
          tabBarIcon: ({ color }) => (
            <Asset name="OrderScreenIcon/Services.png" tint={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: "Customers",
          tabBarIcon: ({ color }) => (
            <Asset name="OrderScreenIcon/Customers.png" tint={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <Asset name="OrderScreenIcon/Profile.png" tint={color} />
          ),
        }}
      />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="orders/[id]" options={{ href: null }} />
    </Tabs>
  );
}
