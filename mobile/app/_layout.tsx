import { InterfaceTheme } from "../src/design/theme";
import { interfaceRole, rolePalette } from "../src/design/theme-tokens";
import { Stack, useSegments } from "expo-router";
import { useEffect } from "react";
import { useAuthStore } from "../src/store/authStore";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { ActivityIndicator, View } from "react-native";
import { socketService } from "../src/services/socket.service";

const queryClient = new QueryClient();

export default function RootLayout() {
  const segments = useSegments();
  const { checkAuth, isLoading, user } = useAuthStore();
  const [fontsLoaded, fontError] = useFonts({
    Inter: Inter_400Regular,
    "Inter-Medium": Inter_500Medium,
    "Inter-SemiBold": Inter_600SemiBold,
    "Inter-Bold": Inter_700Bold,
  });

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!user) return;
    socketService.joinUserRoom(user.id);
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["user-orders"] });
      queryClient.invalidateQueries({ queryKey: ["shop-orders"] });
    };
    const offStatus = socketService.onTransactionUpdate(invalidate);
    const offNew = socketService.onNewTransaction(invalidate);
    return () => {
      offStatus();
      offNew();
      socketService.disconnect();
    };
  }, [user?.id]);

  if (isLoading || (!fontsLoaded && !fontError)) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "white",
        }}
      >
        <ActivityIndicator accessibilityLabel="Loading LabaRide" color={rolePalette(interfaceRole(segments)).primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <InterfaceTheme role={interfaceRole(segments)}><Stack screenOptions={{ headerShown: false }} /></InterfaceTheme>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
