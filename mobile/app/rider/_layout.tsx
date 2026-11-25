import { NotificationBell } from "../../src/design/NotificationBell";
import { Tabs, Redirect } from 'expo-router';
import { View, useWindowDimensions } from 'react-native';
import { History, Bell, LayoutDashboard, Package, UserRound } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfile } from '../../src/design/data';
import { Brand, Button, Empty, Screen, Txt, usePalette } from '../../src/design/ui';
import { QueryState } from '../../src/design/UserScreens';
import { useLogout } from '../../src/design/useLogout';
import { useAuthStore } from '../../src/store/authStore';
import { RiderLocationSharingProvider } from '../../src/design/RiderLocationSharing';
import { workspaceSidebar } from '../../src/navigation/WorkspaceSidebar';
import { useRiderJobUpdates } from '../../src/design/useRiderJobUpdates';
import { riderJobBadge } from '../../src/design/rider-job-updates';

export default function RiderTabs() {
  const profile = useProfile();
  const user = useAuthStore(state => state.user);
  const logout = useLogout();
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const desktop = width >= 1024;
  const insets = useSafeAreaInsets();
  const availableJobs = useRiderJobUpdates(!!user && !!profile.data?.isRider && !profile.isError);
  if (!user) return <Redirect href="/(auth)/login" />;
  if (!profile.data || profile.isError) return <Screen><QueryState loading={profile.isLoading} error={profile.error} retry={() => profile.refetch()} /></Screen>;
  if (!profile.data.isRider) return <Screen><Empty title="Rider access required" message="An administrator must activate your rider account." /><Button title="Sign Out" onPress={logout} /></Screen>;
  return <RiderLocationSharingProvider><Tabs screenOptions={{ headerShown: false, tabBarPosition: desktop ? 'left' : 'bottom', tabBarLabelPosition: desktop ? 'beside-icon' : 'below-icon', tabBarActiveTintColor: palette.primary, tabBarInactiveTintColor: palette.muted, tabBarActiveBackgroundColor: palette.soft,
    tabBarLabelStyle: { fontFamily: 'Inter-Medium', fontSize: desktop ? 12 : 11 }, tabBarItemStyle: { borderRadius: 12, marginHorizontal: desktop ? 8 : 2, marginVertical: desktop ? 4 : 0 },
    tabBarBackground: desktop ? () => <View pointerEvents="none" style={{ position: 'absolute', top: 24, left: 20 }}><Brand /><Txt style={{ color: palette.muted, marginTop: 8 }}>Rider workspace</Txt></View> : undefined,
    tabBarStyle: { width: desktop ? 224 : undefined, minWidth: desktop ? 224 : undefined, maxWidth: desktop ? 224 : undefined, backgroundColor: 'white', borderColor: palette.line, height: desktop ? undefined : 68 + insets.bottom, paddingTop: desktop ? 116 : 8, paddingBottom: Math.max(insets.bottom, 8) },
    ...(desktop ? workspaceSidebar(palette, insets.bottom, 'Rider workspace') : {}),
  }}>
    <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarButtonTestID: 'rider-dashboard-tab', tabBarIcon: ({ color }) => <LayoutDashboard color={color} size={24} /> }} />
    <Tabs.Screen name="available" options={{ title: 'Order requests', tabBarButtonTestID: 'rider-available-tab',
      tabBarBadge: desktop ? undefined : riderJobBadge(availableJobs),
      tabBarLabel: desktop ? ({ color }) => <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginLeft: 10, marginRight: 12, gap: 8 }}>
        <Txt style={{ color, fontFamily: 'Inter-Medium', fontSize: 12 }}>Order requests</Txt>
        {!!availableJobs && <View testID="rider-available-badge" style={{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center' }}><Txt style={{ color: 'white', fontSize: 10, fontWeight: '700', lineHeight: 14 }}>{riderJobBadge(availableJobs)}</Txt></View>}
      </View> : 'Requests',
      tabBarBadgeStyle: { backgroundColor: '#DC2626', color: 'white', fontWeight: '700', fontSize: 10, minWidth: 18, height: 18, lineHeight: 18 }, tabBarIcon: ({ color }) => <Package color={color} size={24} /> }} />
    <Tabs.Screen name="jobs" options={{ title: 'My deliveries', href: null }} />
    <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: ({ color }) => <History color={color} size={24} /> }} />
    <Tabs.Screen name="notifications" options={{ title: 'Updates', tabBarIcon: ({ color }) => <NotificationBell audience="rider" color={color} size={24} /> }} />
    <Tabs.Screen name="profile" options={{ title: 'Profile', href: desktop ? undefined : null, tabBarIcon: ({ color }) => <UserRound color={color} size={24} /> }} />
  </Tabs></RiderLocationSharingProvider>;
}
