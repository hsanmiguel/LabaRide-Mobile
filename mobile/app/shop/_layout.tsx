import { InterfaceTheme } from "../../src/design/theme";
import { View, useWindowDimensions } from "react-native";
import { useEffect } from "react";
import { Tabs, Redirect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Asset, Brand, Txt, Screen, usePalette } from "../../src/design/ui";
import { QueryState } from "../../src/design/UserScreens";
import { useAuthStore } from "../../src/store/authStore";
import { useOwnedShop } from "../../src/design/data";
import { socketService } from "../../src/services/socket.service";
export default function ShopTabs() {
  return <InterfaceTheme role="shop"><ShopTabsContent /></InterfaceTheme>;
}
function ShopTabsContent() {
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const desktop = width >= 1024;
  const insets = useSafeAreaInsets();
  const owned = useOwnedShop();
  const user = useAuthStore(state => state.user);
  useEffect(() => {
    if (owned.data?.approvalStatus === "Approved") socketService.joinShopRoom(owned.data.id);
  }, [owned.data?.id]);
  if (!user) return <Redirect href="/(auth)/login" />;
  if (owned.isLoading || owned.isError) return <Screen><QueryState loading={owned.isLoading} error={owned.error} retry={() => owned.refetch()} /></Screen>;
  if (owned.data?.approvalStatus !== "Approved") return <Redirect href={{ pathname: "/(flows)/[flow]", params: { flow: "register-shop" } }} />;
  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
        tabBarBackground: desktop ? () => <View pointerEvents="none" style={{ position: "absolute", top: 24, left: 20 }}><Brand /><Txt style={{ color: palette.muted, marginTop: 8 }}>Shop management</Txt></View> : undefined,
        tabBarPosition: desktop ? "left" : "bottom",
        tabBarLabelPosition: desktop ? "beside-icon" : "below-icon",
        tabBarActiveBackgroundColor: palette.soft,
        tabBarItemStyle: { borderRadius: 12, marginHorizontal: desktop ? 8 : 2, marginVertical: desktop ? 4 : 0 },
        tabBarHideOnKeyboard: false,
        tabBarActiveTintColor: palette.navy,
        tabBarInactiveTintColor: palette.muted,
        tabBarLabelStyle: { fontFamily: "Inter-Medium", fontSize: 11 },
        tabBarStyle: {

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
          href: null,
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
