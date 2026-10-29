import { Tabs, Redirect } from "expo-router";
import { View, useWindowDimensions } from "react-native";
import { LayoutDashboard, Truck, Bell } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { InterfaceTheme } from "../../src/design/theme";
import { Brand, Button, Empty, Screen, Txt, usePalette } from "../../src/design/ui";
import { useProfile } from "../../src/design/data";
import { QueryState } from "../../src/design/UserScreens";
import { useAuthStore } from "../../src/store/authStore";
import { useLogout } from "../../src/design/useLogout";

export default function AdminTabs() {
  const logout = useLogout();
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const desktop = width >= 1024;
  const insets = useSafeAreaInsets();
  const auth = useAuthStore();
  const profile = useProfile();
  if (!auth.user) return <Redirect href="/(auth)/login" />;
  if (!profile.data || profile.isError) return <Screen title="Admin Panel" brandedHeader back={false}>
    <QueryState loading={profile.isLoading} error={profile.error} retry={() => profile.refetch()} />
  </Screen>;
  if (!profile.data.isAdmin) return <Screen title="Admin Panel" brandedHeader back={false}>
    <Empty title="Admin access required" message="Only an administrator can open this panel." />
    <Button title="Sign Out" onPress={logout} />
  </Screen>;
  return <InterfaceTheme role="admin"><Tabs initialRouteName="index" screenOptions={{
    headerShown: false,
    tabBarPosition: desktop ? "left" : "bottom",
    tabBarLabelPosition: desktop ? "beside-icon" : "below-icon",
    tabBarActiveTintColor: palette.primary,
    tabBarInactiveTintColor: palette.muted,
    tabBarActiveBackgroundColor: palette.soft,
    tabBarLabelStyle: { fontFamily: "Inter-Medium", fontSize: 12 },
    tabBarItemStyle: { borderRadius: 12, marginHorizontal: desktop ? 8 : 2, marginVertical: desktop ? 4 : 0 },
    tabBarBackground: desktop ? () => <View pointerEvents="none" style={{ position: "absolute", top: 24, left: 20 }}>
      <Brand /><Txt style={{ color: palette.muted, marginTop: 8 }}>Admin panel</Txt>
    </View> : undefined,
    tabBarStyle: {
      backgroundColor: "white", borderTopWidth: 1, borderTopColor: palette.line, borderRightColor: palette.line,
      width: desktop ? 224 : undefined, minWidth: desktop ? 224 : undefined, maxWidth: desktop ? 224 : undefined,
      height: desktop ? undefined : 68 + insets.bottom,
      paddingTop: desktop ? 116 : 8, paddingBottom: desktop ? 16 : Math.max(insets.bottom, 8),
    },
  }}>
    <Tabs.Screen name="index" options={{ title: "Dashboard", href: "/admin",
      tabBarIcon: ({ color }) => <LayoutDashboard size={24} color={color} /> }} />
    <Tabs.Screen name="operations" options={{ title: "Delivery Operations", tabBarLabel: desktop ? "Delivery Operations" : "Operations", tabBarAccessibilityLabel: "Delivery Operations", tabBarIcon: ({ color }) => <Truck size={24} color={color} /> }} />
    <Tabs.Screen name="notifications" options={{ title: "Updates", tabBarIcon: ({ color }) => <Bell size={24} color={color} /> }} />
    <Tabs.Screen name="order" options={{ href: null }} />
  </Tabs></InterfaceTheme>;
}
