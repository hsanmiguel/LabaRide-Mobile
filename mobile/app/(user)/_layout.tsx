import { Tabs, useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Asset, palette } from "../../src/design/ui";
export default function UserTabs() {
  const insets = useSafeAreaInsets();
  const segments = useSegments() as string[];
  const hideTabs = segments.some((s) =>
    ["order", "orders", "shops"].includes(s),
  );
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.blue,
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarLabelStyle: { fontFamily: "Inter-Medium", fontSize: 12 },
        tabBarStyle: {
          display: hideTabs ? "none" : "flex",
          backgroundColor: "white",
          height: 68 + insets.bottom,
          paddingTop: 12,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTopWidth: 0,
          elevation: 8,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <Asset name="home.png" tint={color} size={26} />
          ),
        }}
      />
      <Tabs.Screen
        name="activities"
        options={{
          title: "Activities",
          tabBarIcon: ({ color }) => (
            <Asset name="activities.png" tint={color} size={26} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <Asset name="profile.png" tint={color} size={26} />
          ),
        }}
      />
      <Tabs.Screen name="shops/index" options={{ href: null }} />
      <Tabs.Screen name="shops/[id]" options={{ href: null }} />
      <Tabs.Screen name="order/[shopId]" options={{ href: null }} />
      <Tabs.Screen name="order/confirm" options={{ href: null }} />
      <Tabs.Screen name="order/tracking/[id]" options={{ href: null }} />
    </Tabs>
  );
}
