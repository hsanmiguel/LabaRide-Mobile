import { RiderHeader } from './RiderHeader';
import { Pressable, View } from "react-native";
import { useRef, useState } from 'react';
import { useIsFocused } from "expo-router";
import { toast } from "./toast-service";
import { useNotifications, useNotificationVisibility, notificationQueryKey, type Notification } from "./useNotificationToasts";
export type { Notification } from "./useNotificationToasts";
import { Trash2 } from 'lucide-react-native';
import { router, type Href } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Screen, Section, Txt, Empty, Button, styles, usePalette } from "./ui";
import { api, fail, go, confirmAction, message } from "./data";
import { QueryState } from "./UserScreens";
import { useAuthStore } from "../store/authStore";


export function NotificationsDesign({ shopMode = false, audience }: { shopMode?: boolean; audience?: 'rider' | 'admin' }) {
  const palette = usePalette();
  const user = useAuthStore(state => state.user);
  const cache = useQueryClient();
  const pendingDelete = useRef(false);
  const [deleting, setDeleting] = useState<number | 'read' | null>(null);
  const [error, setError] = useState('');
  const queryKey = notificationQueryKey(user?.id, { shopMode, audience });
  const scope = `shopMode=${shopMode}${audience ? `&audience=${audience}` : ''}`;
  const notifications = useNotifications({ shopMode, audience });
  const focused = useIsFocused();
  useNotificationVisibility({ shopMode, audience }, notifications.data, focused);
  const today = new Date().toDateString();
  const readCount = notifications.data?.filter(item => !!item.readAt).length || 0;
  async function remove(item?: Notification) {
    if (pendingDelete.current || item && !item.readAt) return;
    pendingDelete.current = true; setError('');
    try {
      if (!await confirmAction(item ? 'Delete notification?' : 'Delete read notifications?', item ? 'Remove this read notification from your list?' : `Remove read notifications from this list? Unread notifications will stay.`, { confirmLabel: 'Delete', destructive: true })) return;
      setDeleting(item?.id ?? 'read');
      await api.delete(item ? `/notifications/${item.id}` : `/notifications/read?${scope}`);
      cache.setQueryData<Notification[]>(queryKey, current => current?.filter(record => item ? record.id !== item.id : !record.readAt));
      await cache.invalidateQueries({ queryKey: ['notifications', user?.id] });
      toast.info(item ? { title: 'Notification deleted' } : { title: 'Notifications cleared', message: 'Your read notifications are gone.' });
    } catch (failure) { setError(message(failure)); }
    finally { pendingDelete.current = false; setDeleting(null); }
  }

  async function open(notification: Notification) {
    try {
      if (!notification.readAt) {
        await api.put(`/notifications/${notification.id}/read`, {});
        cache.setQueryData<Notification[]>(["notifications", user?.id, shopMode, audience], current =>
          current?.map(item => item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item));
      }
      if (audience === 'rider') router.push({ pathname: '/rider/jobs', params: { orderId: String(notification.transactionId) } });
      else if (audience === 'admin') router.push(`/admin/order?id=${notification.transactionId}` as Href);
      else if (shopMode) router.push({ pathname: "/shop/customers/orders/[id]", params: { id: String(notification.transactionId) } });
      else go("transaction-details", { id: String(notification.transactionId) });
    } catch (error) { fail(error); }
  }

  return <Screen title="Notifications" brandedHeader={audience === 'admin'} header={audience === 'rider' ? <RiderHeader /> : undefined}>
    <View style={styles.stack}>
      {audience === 'rider' && <Txt style={styles.title}>Updates</Txt>}
      <QueryState loading={notifications.isLoading} error={notifications.error} retry={() => notifications.refetch()} />
      {readCount > 0 && <View style={styles.between}><Txt style={{ color: palette.muted, fontSize: 12 }}>Remove read notifications to tidy this list.</Txt><Button title={`Delete read (${readCount})`} compact outline color={palette.danger} busy={deleting === 'read'} disabled={deleting !== null} icon={<Trash2 size={15} color={palette.danger} />} onPress={() => { void remove(); }} /></View>}
      {!!error && <Txt accessibilityRole="alert" style={{ color: palette.danger }}>{error}</Txt>}
      {["Today", "Earlier"].map(group => {
        const items = (notifications.data || []).filter(item =>
          (new Date(item.createdAt).toDateString() === today) === (group === "Today"));
        if (!items.length) return null;
        return <View key={group}>
          <Section title={group} />
          {items.map(item => <View key={item.id} testID={`notification-${item.id}`} style={{ marginBottom: 12, borderRadius: 12, backgroundColor: item.readAt ? palette.surface : palette.soft }}><Pressable accessibilityRole="button"
            accessibilityLabel={`${item.readAt ? "Read" : "Unread"}: ${item.title}. ${item.message}`}
            onPress={() => open(item)}
            style={{ padding: 16, borderRadius: 12 }}>
            <View style={styles.between}>
              <Txt style={{ fontWeight: "700", color: palette.primary }}>{item.title}</Txt>
              {!item.readAt && <Txt style={{ color: palette.primary }}>New</Txt>}
            </View>
            <Txt style={{ marginVertical: 6 }}>{item.message}</Txt>
            <Txt style={styles.muted}>{new Date(item.createdAt).toLocaleString()}</Txt>
          </Pressable>{!!item.readAt && <View style={{ paddingHorizontal: 16, paddingBottom: 12, alignItems: 'flex-end' }}><Button title="Delete" compact outline color={palette.danger} disabled={deleting !== null} busy={deleting === item.id} icon={<Trash2 size={15} color={palette.danger} />} onPress={() => { void remove(item); }} /></View>}</View>)}
        </View>;
      })}
      {!notifications.isLoading && !notifications.error && !notifications.data?.length &&
        <Empty title="No notifications yet" message="New bookings and order status changes will appear here." />}
    </View>
  </Screen>;
}
