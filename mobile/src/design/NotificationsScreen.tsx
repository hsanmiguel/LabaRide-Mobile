import { RiderHeader } from './RiderHeader';
import { Animated, PanResponder, Platform, Pressable, View, useWindowDimensions } from "react-native";
import { useMemo, useRef, useState } from 'react';
import { useIsFocused } from "expo-router";
import { toast } from "./toast-service";
import { useNotifications, useNotificationVisibility, notificationQueryKey, type Notification } from "./useNotificationToasts";
export type { Notification } from "./useNotificationToasts";
import { Archive, Pin, Trash2, RotateCcw } from 'lucide-react-native';
import { router, type Href } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Screen, Section, Txt, Empty, Button, styles, usePalette } from "./ui";
import { api, fail, go, confirmAction, message } from "./data";
import { QueryState } from "./UserScreens";
import { useAuthStore } from "../store/authStore";
import { useNotificationInboxStore } from "./notification-inbox-store";


export function NotificationsDesign({ shopMode = false, audience }: { shopMode?: boolean; audience?: 'rider' | 'admin' }) {
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const mobile = Platform.OS !== 'web' || width < 768;
  const user = useAuthStore(state => state.user);
  const cache = useQueryClient();
  const pendingDelete = useRef(false);
  const [deleting, setDeleting] = useState<number | 'read' | null>(null);
  const [error, setError] = useState('');
  const queryKey = notificationQueryKey(user?.id, { shopMode, audience });
  const scope = `shopMode=${shopMode}${audience ? `&audience=${audience}` : ''}`;
  const inboxScope = JSON.stringify([user?.id, !!shopMode, audience || 'customer']);
  const inboxState = useNotificationInboxStore(state => state.byScope[inboxScope]);
  const togglePin = useNotificationInboxStore(state => state.togglePin);
  const setArchived = useNotificationInboxStore(state => state.setArchived);
  const [showArchived, setShowArchived] = useState(false);
  const notifications = useNotifications({ shopMode, audience });
  const pullY = useRef(new Animated.Value(0)).current;
  const pullDistance = useRef(0);
  const scrollOffset = useRef(0);
  const refreshingRef = useRef(false);
  const [pullReady, setPullReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const focused = useIsFocused();
  useNotificationVisibility({ shopMode, audience }, notifications.data, focused);
  const today = new Date().toDateString();
  const readCount = notifications.data?.filter(item => !!item.readAt).length || 0;
  const archivedIds = inboxState?.archived || [];
  const pinnedIds = inboxState?.pinned || [];
  const visibleItems = (notifications.data || []).filter(item => mobile
    ? archivedIds.includes(item.id) === showArchived : true).sort((a, b) =>
      Number(pinnedIds.includes(b.id)) - Number(pinnedIds.includes(a.id)) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const pullResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) => mobile && !refreshingRef.current && scrollOffset.current <= 1 && gesture.dy > 8 && gesture.dy > Math.abs(gesture.dx) * 1.15,
    onPanResponderMove: (_, gesture) => {
      const distance = Math.min(112, Math.max(0, gesture.dy * 0.42));
      pullDistance.current = distance;
      setPullReady(distance >= 72);
      pullY.setValue(distance);
    },
    onPanResponderRelease: (_, gesture) => {
      if (pullDistance.current >= 72 && gesture.dy > 100) {
        refreshingRef.current = true;
        setRefreshing(true);
        Animated.spring(pullY, { toValue: 76, useNativeDriver: false, damping: 22, stiffness: 180 }).start();
        void notifications.refetch().finally(() => {
          refreshingRef.current = false;
          setRefreshing(false);
          setPullReady(false);
          pullDistance.current = 0;
          Animated.spring(pullY, { toValue: 0, useNativeDriver: false, damping: 20, stiffness: 180 }).start();
        });
      } else {
        pullDistance.current = 0;
        setPullReady(false);
        Animated.spring(pullY, { toValue: 0, useNativeDriver: false, damping: 20, stiffness: 180 }).start();
      }
    },
    onPanResponderTerminate: () => {
      pullDistance.current = 0;
      setPullReady(false);
      Animated.spring(pullY, { toValue: 0, useNativeDriver: false, damping: 20, stiffness: 180 }).start();
    },
  }), [mobile, notifications.refetch, pullY]);
  async function remove(item?: Notification, swipeDelete = false) {
    if (pendingDelete.current) return;
    pendingDelete.current = true; setError('');
    try {
      if (!swipeDelete && !await confirmAction(item ? 'Delete notification?' : 'Delete read notifications?', item ? 'Remove this notification from your list?' : `Remove read notifications from this list? Unread notifications will stay.`, { confirmLabel: 'Delete', destructive: true })) return;
      setDeleting(item?.id ?? 'read');
      if (item && !item.readAt) await api.put(`/notifications/${item.id}/read`, {});
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

  return <Screen title="Notifications" maxWidth={960} scroll={false} brandedHeader={audience === 'admin'} header={audience === 'rider' ? <RiderHeader /> : undefined}>
    <Animated.ScrollView {...(mobile ? pullResponder.panHandlers : {})} style={{ flex: 1, width: '100%' }}
      contentContainerStyle={{ gap: 20 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
      scrollEventThrottle={16} onScroll={event => { scrollOffset.current = event.nativeEvent.contentOffset.y; }}>
      {mobile && <Animated.View style={{ height: pullY, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' }}>
        <View style={{ width: 116, paddingVertical: 10, gap: 4, alignItems: 'center' }}>
          {[0, 1, 2].map(index => <View key={index} style={{ width: 64, height: 4, borderRadius: 4, backgroundColor: palette.line, overflow: 'hidden' }}>
            <Animated.View style={{ height: '100%', width: pullY.interpolate({ inputRange: [0, 76], outputRange: ['0%', '100%'], extrapolate: 'clamp' }), backgroundColor: palette.primary }} />
          </View>)}
          <Txt style={{ color: palette.muted, fontSize: 11, marginTop: 2 }}>{refreshing ? 'Loading new updates…' : pullReady ? 'Release to refresh' : 'Pull to refresh'}</Txt>
        </View>
      </Animated.View>}
    <View style={styles.stack}>
      {audience === 'rider' && <Txt style={styles.title}>Updates</Txt>}
      {mobile && <View style={{ flexDirection: 'row', gap: 8 }}>
        {[
          { archived: false, label: `Inbox (${(notifications.data || []).filter(item => !archivedIds.includes(item.id)).length})` },
          { archived: true, label: `Archived (${archivedIds.length})` },
        ].map(tab => <Pressable key={tab.label} accessibilityRole="button" accessibilityState={{ selected: showArchived === tab.archived }}
          onPress={() => setShowArchived(tab.archived)} style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 20,
            backgroundColor: showArchived === tab.archived ? palette.primary : 'white', borderWidth: 1, borderColor: showArchived === tab.archived ? palette.primary : palette.line }}>
          <Txt style={{ color: showArchived === tab.archived ? 'white' : palette.muted, fontWeight: '600', fontSize: 13 }}>{tab.label}</Txt>
        </Pressable>)}
      </View>}
      <QueryState loading={notifications.isLoading} error={notifications.error} retry={() => notifications.refetch()} />
      {!showArchived && readCount > 1 && <View style={[styles.between, { padding: 16, borderRadius: 14, backgroundColor: "white", borderWidth: 1, borderColor: palette.line }]}><View style={{ flex: 1, minWidth: 180 }}><Txt style={{ fontWeight: "600" }}>Tidy up your updates</Txt><Txt style={{ color: palette.muted, fontSize: 12 }}>Remove all {readCount} read notifications at once.</Txt></View><Button title={`Delete read (${readCount})`} compact outline color={palette.danger} busy={deleting === 'read'} disabled={deleting !== null} icon={<Trash2 size={15} color={palette.danger} />} onPress={() => { void remove(); }} /></View>}
      {!!error && <Txt accessibilityRole="alert" style={{ color: palette.danger }}>{error}</Txt>}
      {["Today", "Earlier"].map(group => {
        const items = visibleItems.filter(item => mobile && showArchived ? group === 'Earlier'
          : (new Date(item.createdAt).toDateString() === today) === (group === "Today"));
        if (!items.length) return null;
        return <View key={group}>
          <Section title={mobile && showArchived ? "Archived" : group} />
          {items.map(item => mobile ? <SwipeableNotificationRow key={item.id} item={item} archived={archivedIds.includes(item.id)} pinned={pinnedIds.includes(item.id)}
            palette={palette} deleting={deleting !== null} onOpen={() => { void open(item); }} onPin={() => togglePin(inboxScope, item.id)}
            onArchive={() => setArchived(inboxScope, item.id, !archivedIds.includes(item.id))} onDelete={(fullSwipe) => { void remove(item, fullSwipe); }} /> : <View key={item.id} testID={`notification-${item.id}`} style={{ marginBottom: 12, borderRadius: 12, backgroundColor: item.readAt ? palette.surface : palette.soft }}><Pressable accessibilityRole="button"
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
      {!notifications.isLoading && !notifications.error && !visibleItems.length &&
        <Empty title={showArchived ? "No archived notifications" : "No notifications yet"} message={showArchived ? "Notifications you archive will appear here." : "New bookings and order status changes will appear here."} />}
    </View>
    </Animated.ScrollView>
  </Screen>;
}

function SwipeableNotificationRow({ item, archived, pinned, palette, deleting, onOpen, onPin, onArchive, onDelete }: {
  item: Notification; archived: boolean; pinned: boolean; palette: ReturnType<typeof usePalette>; deleting: boolean;
  onOpen: () => void; onPin: () => void; onArchive: () => void; onDelete: (fullSwipe: boolean) => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const rowWidth = useRef(0);
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
    onPanResponderMove: (_, gesture) => translateX.setValue(Math.max(-172, Math.min(86, gesture.dx))),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx < -Math.max(180, rowWidth.current * 0.72) || (gesture.vx < -1.7 && gesture.dx < -70)) {
        Animated.timing(translateX, { toValue: -rowWidth.current, duration: 150, useNativeDriver: true }).start(() => onDelete(true));
        return;
      }
      const target = gesture.dx < -58 ? -172 : gesture.dx > 58 ? 86 : 0;
      Animated.spring(translateX, { toValue: target, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
    },
    onPanResponderTerminate: () => Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start(),
  }), [onDelete, translateX]);
  const close = () => Animated.spring(translateX, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
  const action = (label: string, color: string, Icon: typeof Pin, callback: () => void) => <Pressable accessibilityRole="button" accessibilityLabel={label}
    disabled={deleting} onPress={() => { close(); callback(); }} style={{ width: 86, alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: color }}>
      <Icon size={20} color="white" /><Txt style={{ color: 'white', fontSize: 11, fontWeight: '600' }}>{label}</Txt>
    </Pressable>;
  return <View testID={`notification-${item.id}`} onLayout={event => { rowWidth.current = event.nativeEvent.layout.width; }}
    style={{ position: 'relative', overflow: 'hidden', marginBottom: 12, borderRadius: 12, minHeight: 124,
      backgroundColor: item.readAt ? palette.surface : palette.soft }}>
    <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, flexDirection: 'row', justifyContent: 'space-between' }}>
      {action(pinned ? 'Unpin' : 'Pin', palette.primary, Pin, onPin)}
      <View style={{ flexDirection: 'row' }}>
        {action(archived ? 'Restore' : 'Archive', '#64748B', archived ? RotateCcw : Archive, onArchive)}
        {action('Delete', palette.danger, Trash2, () => onDelete(false))}
      </View>
    </View>
    <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX }], backgroundColor: item.readAt ? palette.surface : palette.soft }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${item.readAt ? "Read" : "Unread"}: ${item.title}. ${item.message}${pinned ? '. Pinned' : ''}`}
        onPress={onOpen} style={{ padding: 16, minHeight: 124, justifyContent: 'center' }}>
        <View style={styles.between}><View style={[styles.row, { gap: 6, flex: 1 }]}>{pinned && <Pin size={14} color={palette.primary} />}<Txt style={{ fontWeight: '700', color: palette.primary }}>{item.title}</Txt></View>{!item.readAt && <Txt style={{ color: palette.primary }}>New</Txt>}</View>
        <Txt style={{ marginVertical: 6 }}>{item.message}</Txt>
        <Txt style={styles.muted}>{new Date(item.createdAt).toLocaleString()}</Txt>
      </Pressable>
    </Animated.View>
  </View>;
}
