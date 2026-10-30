import { Tabs, Redirect } from 'expo-router';
import { View, useWindowDimensions } from 'react-native';
import { Bike, History, Bell, LayoutDashboard } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfile } from '../../src/design/data';
import { Brand, Button, Empty, Screen, Txt, usePalette } from '../../src/design/ui';
import { QueryState } from '../../src/design/UserScreens';
import { useLogout } from '../../src/design/useLogout';
import { useAuthStore } from '../../src/store/authStore';
import { RiderLocationSharingProvider } from '../../src/design/RiderLocationSharing';

export default function RiderTabs() {
  const profile = useProfile();
  const user = useAuthStore(state => state.user);
  const logout = useLogout();
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const desktop = width >= 1024;
  const insets = useSafeAreaInsets();
  if (!user) return <Redirect href="/(auth)/login" />;
  if (!profile.data || profile.isError) return <Screen><QueryState loading={profile.isLoading} error={profile.error} retry={() => profile.refetch()} /></Screen>;
  if (!profile.data.isRider) return <Screen><Empty title="Rider access required" message="An administrator must activate your rider account." /><Button title="Sign Out" onPress={logout} /></Screen>;
  return <RiderLocationSharingProvider><Tabs screenOptions={{ headerShown: false, tabBarPosition: desktop ? 'left' : 'bottom', tabBarLabelPosition: desktop ? 'beside-icon' : 'below-icon', tabBarActiveTintColor: palette.primary, tabBarInactiveTintColor: palette.muted, tabBarActiveBackgroundColor: palette.soft,
    tabBarLabelStyle: { fontFamily: 'Inter-Medium', fontSize: 12 }, tabBarItemStyle: { borderRadius: 12, marginHorizontal: desktop ? 8 : 2, marginVertical: desktop ? 4 : 0 },
    tabBarBackground: desktop ? () => <View pointerEvents="none" style={{ position: 'absolute', top: 24, left: 20 }}><Brand /><Txt style={{ color: palette.muted, marginTop: 8 }}>Rider workspace</Txt></View> : undefined,
    tabBarStyle: { width: desktop ? 224 : undefined, minWidth: desktop ? 224 : undefined, maxWidth: desktop ? 224 : undefined, backgroundColor: 'white', borderColor: palette.line, height: desktop ? undefined : 68 + insets.bottom, paddingTop: desktop ? 116 : 8, paddingBottom: Math.max(insets.bottom, 8) },
  }}>
    <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: ({ color }) => <LayoutDashboard color={color} size={24} /> }} />
    <Tabs.Screen name="jobs" options={{ title: 'My jobs', tabBarIcon: ({ color }) => <Bike color={color} size={24} /> }} />
    <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: ({ color }) => <History color={color} size={24} /> }} />
    <Tabs.Screen name="notifications" options={{ title: 'Updates', tabBarIcon: ({ color }) => <Bell color={color} size={24} /> }} />
  </Tabs></RiderLocationSharingProvider>;
}
