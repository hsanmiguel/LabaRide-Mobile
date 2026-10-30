import { View } from "react-native";
import type { Order } from "./data";
import { PriceRow, Section, Txt, styles } from "./ui";
import { ProcessingTimer } from "./ProcessingTimer";
import type { ProcessingTimingOrder } from "./processing-timer";

export type TurnaroundOrder = Pick<Order, 'status' | 'deliveryType' | 'requestedPickupAt' | 'confirmedPickupAt' | 'receivedAt' | 'processingStartedAt' | 'estimatedReadyAt' | 'estimateReason' | 'readyAt'> & ProcessingTimingOrder;
export const turnaroundTime = (value: string) => new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila" }) + " (Philippine time)";
export function orderUpdateText(order: TurnaroundOrder) {
  const labels: Record<Order["status"], string> = {
    Pending: "Waiting for shop confirmation", Accepted: "Accepted · awaiting your laundry",
    Queued: "Laundry received · waiting in the shop’s queue", Processing: "Your laundry is being processed",
    Ready: order.deliveryType === "Deliver" ? "Laundry ready · arranging return delivery" : "Your laundry is ready to collect",
    Completed: "Order completed", Cancelled: "Order cancelled",
  };
  return labels[order.status];
}
export function TurnaroundDetails({ order }: { order: TurnaroundOrder }) {
  return <View style={{ gap: 10 }}>
    <Section title="Turnaround & Updates" />
    <ProcessingTimer order={order} />
    <Txt>{orderUpdateText(order)}</Txt>
    {!!order.requestedPickupAt && <PriceRow label="Requested laundry pickup" value={turnaroundTime(order.requestedPickupAt)} />}
    {!!order.requestedPickupAt && <Txt style={styles.muted}>{order.confirmedPickupAt ? "Pickup confirmed by the shop." : "Pickup availability is awaiting shop confirmation."}</Txt>}
    {!!order.receivedAt && <PriceRow label="Laundry received" value={turnaroundTime(order.receivedAt)} />}
    {!!order.processingStartedAt && <PriceRow label="Processing started" value={turnaroundTime(order.processingStartedAt)} />}
    {!!order.estimatedReadyAt ? <PriceRow label="Estimated ready time" value={turnaroundTime(order.estimatedReadyAt)} />
      : <Txt style={styles.muted}>The shop will confirm your laundry’s completion time after receiving it, based on its queue.</Txt>}
    {!!order.estimateReason && <Txt style={styles.muted}>Estimate update: {order.estimateReason}</Txt>}
    {!!order.readyAt && <PriceRow label="Laundry ready" value={turnaroundTime(order.readyAt)} />}
    <Txt style={styles.muted}>{order.deliveryType === "Deliver" ? "Return delivery will be arranged once your laundry is ready." : "We’ll notify you when your laundry is ready to collect."}</Txt>
  </View>;
}
