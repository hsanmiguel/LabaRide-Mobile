import { InterfaceTheme } from "../../src/design/theme";
import { View, useWindowDimensions } from "react-native";
import { Tabs, useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Asset, Brand, Txt, usePalette } from "../../src/design/ui";
export default function UserTabs() {
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const desktop = width >= 1024;
  const insets = useSafeAreaInsets();
  const segments = useSegments() as string[];
  const hideTabs = segments.some((s) =>
    ["order", "orders", "shops"].includes(s),
  );
  return (
    <InterfaceTheme role="customer"><Tabs
      screenOptions={{
        headerShown: false,
        tabBarBackground: desktop ? () => <View pointerEvents="none" style={{ position: "absolute", top: 24, left: 20 }}><Brand /><Txt style={{ color: palette.muted, marginTop: 8 }}>Your laundry, simplified</Txt></View> : undefined,
        tabBarPosition: desktop ? "left" : "bottom",
        tabBarLabelPosition: desktop ? "beside-icon" : "below-icon",
        tabBarActiveBackgroundColor: palette.soft,
        tabBarItemStyle: { borderRadius: 12, marginHorizontal: desktop ? 8 : 2, marginVertical: desktop ? 4 : 0 },
        tabBarActiveTintColor: palette.blue,
        tabBarInactiveTintColor: palette.muted,
        tabBarLabelStyle: { fontFamily: "Inter-Medium", fontSize: 12 },
        tabBarStyle: {
          display: hideTabs ? "none" : "flex",
          backgroundColor: "white", borderTopWidth: 1, borderTopColor: palette.line,
          borderRightColor: palette.line, width: desktop ? 224 : undefined, maxWidth: desktop ? 224 : undefined, minWidth: desktop ? 224 : undefined,
          height: desktop ? undefined : 68 + insets.bottom,
          paddingTop: desktop ? 116 : 8, paddingBottom: desktop ? 16 : Math.max(insets.bottom, 8),
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
          title: "Orders",
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
    </Tabs></InterfaceTheme>
  );
}
