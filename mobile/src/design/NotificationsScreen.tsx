import { orderUpdateText, turnaroundTime } from "./TurnaroundDetails";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import {
  Asset,
  Card,
  Empty,
  Screen,
  Section,
  Txt,
  usePalette,
  styles,
} from "./ui";
import { go, useOrders } from "./data";
import { QueryState } from "./UserScreens";

export function NotificationsDesign({
  shopMode = false,
}: {
  shopMode?: boolean;
}) {
  const palette = usePalette();
  const orders = useOrders(shopMode);
  const today = new Date().toDateString();
  return (
    <Screen title="Notifications">
      <View style={styles.stack}>
        <QueryState
          loading={orders.isLoading}
          error={orders.error}
          retry={() => orders.refetch()}
        />
        {["Today", "Earlier"].map((group) => {
          const items = (orders.data || []).filter(
            (order) =>
              (new Date(order.updatedAt || order.createdAt).toDateString() === today) ===
              (group === "Today"),
          );
          if (!items.length) return null;
          return (
            <View key={group}>
              <Section title={group} />
              {items.map((order) => (
                <Pressable accessibilityRole="button"
                  key={order.id}
                  onPress={() =>
                    shopMode
                      ? router.push({
                          pathname: "/shop/customers/orders/[id]",
                          params: { id: String(order.id) },
                        })
                      : go("transaction-details", { id: String(order.id) })
                  }
                  style={[styles.row, { marginBottom: 16, paddingVertical: 8 }]}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: shopMode ? palette.navy : palette.primary,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Asset
                      name={
                        shopMode ? "adminIcon/ellipseblue.png" : "profile.png"
                      }
                      tint="white"
                      size={24}
                    />
                  </View>
                  <View style={styles.grow}>
                    <Txt
                      style={{
                        fontFamily: "Poppins",
                        fontWeight: "700",
                        color: palette.primary,
                      }}
                    >
                      {shopMode
                        ? order.userName
                        : order.shop?.shopName || "Laundry Shop"}
                    </Txt>
                    <Txt
                      style={{
                        fontFamily: "Poppins",
                        fontSize: 12,
                        marginVertical: 4,
                      }}
                    >
                      Order #{order.id} · {orderUpdateText(order)}
                    </Txt>
                    {!!order.estimatedReadyAt && <Txt style={{ fontSize: 12 }}>Estimated ready: {turnaroundTime(order.estimatedReadyAt)}{order.estimateReason ? ` · ${order.estimateReason}` : ""}</Txt>}
                    <Txt
                      style={{
                        fontFamily: "Poppins",
                        fontSize: 12,
                        color: palette.muted,
                      }}
                    >
                      {new Date(order.updatedAt || order.createdAt).toLocaleString()}
                    </Txt>
                  </View>
                </Pressable>
              ))}
            </View>
          );
        })}
        {!orders.isLoading && !orders.error && !orders.data?.length && (
          <Empty
            title="No notifications yet"
            message="Updates about your laundry orders will appear here."
          />
        )}
      </View>
    </Screen>
  );
}
