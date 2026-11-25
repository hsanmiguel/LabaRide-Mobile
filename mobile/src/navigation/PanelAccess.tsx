import { Stack } from "expo-router";
import { useAuthStore } from "../store/authStore";

// Admin sessions have their own panel, including direct links and browser Back.
export function PanelAccess() {
  const user = useAuthStore(state => state.user);
  const isAdmin = useAuthStore(state => state.user?.isAdmin);
  const isRider = useAuthStore(state => state.user?.isRider);
  const application = useAuthStore(state => state.user?.riderApplicationStatus);
  return <Stack screenOptions={{ headerShown: false }}>
    <Stack.Screen name="(auth)/login" />
    <Stack.Screen name="(user)/shops" />
    <Stack.Screen name="(user)/shops/[id]" />
    <Stack.Protected guard={!!user && !isAdmin && !isRider && !application}>
      <Stack.Screen name="(user)/home" />
      <Stack.Screen name="(user)/activities" />
      <Stack.Screen name="(user)/profile" />
      <Stack.Screen name="(user)/order/[shopId]" />
      <Stack.Screen name="(user)/order/confirm" />
      <Stack.Screen name="(user)/order/tracking/[id]" />
      <Stack.Screen name="shop" />
    </Stack.Protected>
    <Stack.Screen name="(flows)/[flow]" />
    <Stack.Screen name="(onboarding)/welcome" />
    <Stack.Screen name="admin" />
    <Stack.Screen name="rider" />
    <Stack.Screen name="(auth)/signup" />
    <Stack.Screen name="(auth)/rider-signup" />
    <Stack.Screen name="rider-application" />
    <Stack.Screen name="index" />
  </Stack>;
}
