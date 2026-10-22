import { orderUpdateText, turnaroundTime } from "./TurnaroundDetails";
import { useRef } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { Bell, ChevronRight, X } from "lucide-react-native";
import { go, message, useOrders } from "./data";
import { Button, Empty, Txt, styles, usePalette } from "./ui";

export function RecentNotificationsModal({ anchor, onClose }: {
  anchor: { x: number; y: number; width: number; height: number };
  onClose: () => void;
}) {
  const palette = usePalette();
  const { width, height } = useWindowDimensions();
  const panelWidth = Math.min(420, width - 24);
  const panelTop = anchor.y + anchor.height + 8;
  const panelLeft = Math.max(12, Math.min(anchor.x + anchor.width - panelWidth, width - panelWidth - 12));
  const orders = useOrders();
  const closeButton = useRef<View>(null);
  const recent = [...(orders.data || [])]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime() || b.id - a.id)
    .slice(0, 5);

  return <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}
    aria-labelledby="recent-notifications-title"
    onShow={() => { if (Platform.OS === "web") closeButton.current?.focus(); }}>
    <View style={{ flex: 1 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss notifications" tabIndex={-1} onPress={onClose}
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }} />
      <View accessibilityViewIsModal aria-labelledby="recent-notifications-title"
        style={{ position: "absolute", top: panelTop, left: panelLeft, width: panelWidth,
          maxHeight: Math.max(0, Math.min(560, height - panelTop - 12)), borderRadius: 20, backgroundColor: "white",
          borderWidth: 1, borderColor: palette.line, shadowColor: "#202033", shadowOpacity: 0.16,
          shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 8, overflow: "hidden" }}>
        <View style={[styles.row, { padding: 20, borderBottomWidth: 1, borderBottomColor: palette.line }]}>
          <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: palette.soft, alignItems: "center", justifyContent: "center" }}>
            <Bell size={22} color={palette.primary} />
          </View>
          <View style={styles.grow}>
            <Txt nativeID="recent-notifications-title" accessibilityRole="header" style={{ fontSize: 19, fontWeight: "700" }}>Recent notifications</Txt>
            <Txt style={{ color: palette.muted, fontSize: 12 }}>Your latest laundry order updates</Txt>
          </View>
          <Pressable ref={closeButton} accessibilityRole="button" accessibilityLabel="Close notifications" onPress={onClose}
            style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? palette.soft : "white" })}>
            <X size={20} color={palette.muted} />
          </Pressable>
        </View>
        <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 20, gap: 12 }} keyboardShouldPersistTaps="handled">
          {orders.isLoading ? <ActivityIndicator accessibilityLabel="Loading notifications" color={palette.primary} style={{ marginVertical: 24 }} />
            : orders.error ? <View accessibilityRole="alert" style={{ gap: 12 }}>
              <Txt style={{ color: palette.muted }}>{message(orders.error)}</Txt>
              <Button title="Retry" outline onPress={() => { void orders.refetch(); }} />
            </View>
            : recent.length ? recent.map(order => <Pressable key={order.id} accessibilityRole="button"
              accessibilityLabel={`Order ${order.id}, ${order.status}. View details`}
              onPress={() => { onClose(); go("transaction-details", { id: String(order.id) }); }}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 14,
                borderRadius: 16, borderWidth: 1, borderColor: palette.line, backgroundColor: pressed ? palette.soft : "white" })}>
              <View style={styles.grow}>
                <Txt numberOfLines={1} style={{ fontWeight: "600", color: palette.primary }}>{order.shop?.shopName || "Laundry Shop"}</Txt>
                <Txt numberOfLines={2} style={{ fontSize: 13, marginTop: 4 }}>{`Order #${order.id} · ${orderUpdateText(order)}`}</Txt>
                {!!order.estimatedReadyAt && <Txt style={{ fontSize: 12 }}>Estimated ready: {turnaroundTime(order.estimatedReadyAt)}{order.estimateReason ? ` · ${order.estimateReason}` : ""}</Txt>}
<Txt style={{ fontSize: 11, color: palette.muted, marginTop: 6 }}>{new Date(order.updatedAt || order.createdAt).toLocaleString()}</Txt>
              </View>
              <ChevronRight size={18} color={palette.primary} />
            </Pressable>)
              : <Empty title="No notifications yet" message="Updates about your laundry orders will appear here." />}
        </ScrollView>
        <View style={{ padding: 20, borderTopWidth: 1, borderTopColor: palette.line }}>
          <Button title="Check all notifications" onPress={() => { onClose(); go("notifications"); }} />
        </View>
      </View>
    </View>
  </Modal>;
}
