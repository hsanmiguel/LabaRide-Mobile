import { Stack } from "expo-router";
import { useAuthStore } from "../store/authStore";

// Admin sessions have their own panel, including direct links and browser Back.
export function PanelAccess() {
  const isAdmin = useAuthStore(state => state.user?.isAdmin);
  const isRider = useAuthStore(state => state.user?.isRider);
  const application = useAuthStore(state => state.user?.riderApplicationStatus);
  return <Stack screenOptions={{ headerShown: false }}>
    <Stack.Protected guard={!isAdmin && !isRider && !application}>
      <Stack.Screen name="(user)" />
      <Stack.Screen name="shop" />
      <Stack.Screen name="(flows)/[flow]" />
      <Stack.Screen name="(onboarding)/welcome" />
    </Stack.Protected>
    <Stack.Screen name="admin" />
    <Stack.Screen name="rider" />
    <Stack.Screen name="(auth)/login" />
    <Stack.Screen name="(auth)/signup" />
    <Stack.Screen name="(auth)/rider-signup" />
    <Stack.Screen name="rider-application" />
    <Stack.Screen name="index" />
  </Stack>;
}
