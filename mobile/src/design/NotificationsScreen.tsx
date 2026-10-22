import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Screen, Section, Txt, Empty, styles, usePalette } from "./ui";
import { api, fail, go } from "./data";
import { QueryState } from "./UserScreens";
import { useAuthStore } from "../store/authStore";

interface Notification {
  id: number;
  transactionId: number;
  title: string;
  message: string;
  createdAt: string;
  readAt: string | null;
}

export function NotificationsDesign({ shopMode = false }: { shopMode?: boolean }) {
  const palette = usePalette();
  const user = useAuthStore(state => state.user);
  const cache = useQueryClient();
  const notifications = useQuery({
    queryKey: ["notifications", user?.id, shopMode],
    enabled: !!user,
    queryFn: () => api.get<Notification[]>(`/notifications?shopMode=${shopMode}`),
    refetchInterval: 15000,
  });
  const today = new Date().toDateString();

  async function open(notification: Notification) {
    try {
      if (!notification.readAt) {
        await api.put(`/notifications/${notification.id}/read`, {});
        cache.setQueryData<Notification[]>(["notifications", user?.id, shopMode], current =>
          current?.map(item => item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item));
      }
      if (shopMode) router.push({ pathname: "/shop/customers/orders/[id]", params: { id: String(notification.transactionId) } });
      else go("transaction-details", { id: String(notification.transactionId) });
    } catch (error) { fail(error); }
  }

  return <Screen title="Notifications">
    <View style={styles.stack}>
      <QueryState loading={notifications.isLoading} error={notifications.error} retry={() => notifications.refetch()} />
      {["Today", "Earlier"].map(group => {
        const items = (notifications.data || []).filter(item =>
          (new Date(item.createdAt).toDateString() === today) === (group === "Today"));
        if (!items.length) return null;
        return <View key={group}>
          <Section title={group} />
          {items.map(item => <Pressable key={item.id} accessibilityRole="button"
            accessibilityLabel={`${item.readAt ? "Read" : "Unread"}: ${item.title}. ${item.message}`}
            onPress={() => open(item)}
            style={{ padding: 16, marginBottom: 12, borderRadius: 12, backgroundColor: item.readAt ? palette.surface : palette.soft }}>
            <View style={styles.between}>
              <Txt style={{ fontWeight: "700", color: palette.primary }}>{item.title}</Txt>
              {!item.readAt && <Txt style={{ color: palette.primary }}>New</Txt>}
            </View>
            <Txt style={{ marginVertical: 6 }}>{item.message}</Txt>
            <Txt style={styles.muted}>{new Date(item.createdAt).toLocaleString()}</Txt>
          </Pressable>)}
        </View>;
      })}
      {!notifications.isLoading && !notifications.error && !notifications.data?.length &&
        <Empty title="No notifications yet" message="New bookings and order status changes will appear here." />}
    </View>
  </Screen>;
}
