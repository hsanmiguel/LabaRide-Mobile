import { useEffect } from "react";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Asset, palette } from "../../src/design/ui";
import { useOwnedShop } from "../../src/design/data";
import { socketService } from "../../src/services/socket.service";
export default function ShopTabs() {
  const insets = useSafeAreaInsets();
  const owned = useOwnedShop();
  useEffect(() => {
    if (owned.data) socketService.joinShopRoom(owned.data.id);
  }, [owned.data?.id]);
  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: false,
        tabBarActiveTintColor: palette.navy,
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarLabelStyle: { fontFamily: "Inter-Medium", fontSize: 11 },
        tabBarStyle: {
          backgroundColor: "white",
          height: 64 + insets.bottom,
          paddingTop: 10,
          paddingBottom: insets.bottom,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          href: "/shop/home",
          tabBarIcon: ({ color }) => (
            <Asset name="OrderScreenIcon/Home.png" tint={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Orders",
          href: "/shop/transactions",
          tabBarIcon: ({ color }) => (
            <Asset name="OrderScreenIcon/Orders.png" tint={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: "Services",
          href: "/shop/services",
          tabBarIcon: ({ color }) => (
            <Asset name="OrderScreenIcon/Services.png" tint={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: "Customers",
          href: "/shop/customers",
          tabBarIcon: ({ color }) => (
            <Asset name="OrderScreenIcon/Customers.png" tint={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          href: "/shop/profile",
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
