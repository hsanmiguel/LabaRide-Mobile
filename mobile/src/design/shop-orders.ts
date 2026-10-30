import type { Order } from "./data";

export type OrderSection = "Active" | "Past";
export type ShopOrderFilter = "All" | "In progress" | Order["status"];
export const activeStatuses: Order["status"][] = ["Pending", "Accepted", "Queued", "Processing", "Ready"];
export const pastStatuses: Order["status"][] = ["Completed", "Cancelled"];

export function shopOrderStatus(order: Order): Order["status"] {
  const stage = order.workflowStatus;
  if (!stage) return order.status;
  if (stage === "Completed" || stage === "Cancelled") return stage;
  if (stage === "BookingPending") return "Pending";
  if (stage === "LaundryReceived") return "Queued";
  if (["Washing", "Drying", "Folding"].includes(stage)) return "Processing";
  if (["ReadyForCollection", "ReadyForDelivery", "DeliveryAssigned", "DeliveryAccepted", "CleanLaundryCollected", "OutForDelivery", "Delivered"].includes(stage)) return "Ready";
  return "Accepted";
}

export function orderIsPast(order: Order) {
  return pastStatuses.includes(shopOrderStatus(order));
}

export function matchesOrderFilter(order: Order, filter: ShopOrderFilter) {
  const status = shopOrderStatus(order);
  return filter === "All" || (filter === "In progress" ? ["Accepted", "Queued", "Processing"].includes(status) : status === filter);
}

export function visibleShopOrders(orders: Order[], section: OrderSection, filter: ShopOrderFilter, query: string, oldestFirst = false) {
  const search = query.trim().toLowerCase().replace(/^#/, "");
  return orders.filter(order => orderIsPast(order) === (section === "Past") && matchesOrderFilter(order, filter) &&
    `${order.id} ${order.userName} ${order.serviceName}`.toLowerCase().includes(search))
    .sort((a, b) => (Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id) * (oldestFirst ? 1 : -1));
}

export function shopOrderProgress(order: Order) {
  const labels: Record<string, string> = {
    BookingPending: "Awaiting your approval", PickupQueued: "Awaiting a pickup rider", PickupAssigned: "Pickup rider assigned",
    PickupAccepted: "Pickup rider confirmed", PickupEnRoute: "Pickup en route", LaundryPickedUp: "Laundry on the way to shop",
    AtPartner: "At shop · confirm receipt", LaundryReceived: "Received · in queue", Washing: "Washing", Drying: "Drying", Folding: "Folding",
    ReadyForCollection: "Awaiting customer collection", ReadyForDelivery: "Awaiting a delivery rider", DeliveryAssigned: "Delivery rider assigned",
    DeliveryAccepted: "Delivery rider confirmed", CleanLaundryCollected: "Collected by delivery rider", OutForDelivery: "Out for delivery",
    Delivered: "Awaiting delivery confirmation", Completed: "Order completed", Cancelled: "Order cancelled",
  };
  if (order.workflowStatus) return labels[order.workflowStatus] || order.workflowStatus.replace(/([a-z])([A-Z])/g, "$1 $2");
  return { Pending: "Awaiting your approval", Accepted: "Awaiting laundry arrival", Queued: "Received · in queue", Processing: "Laundry in progress",
    Ready: order.deliveryType === "Deliver" ? "Arrange return delivery" : "Awaiting customer collection", Completed: "Order completed", Cancelled: "Order cancelled" }[order.status];
}

export function shopOrderTiming(order: Order) {
  if (orderIsPast(order)) return { label: order.updatedAt ? "Last updated" : "Placed", value: order.updatedAt || order.createdAt };
  if (order.requestedPickupAt && ["Pending", "Accepted"].includes(shopOrderStatus(order)) && !order.receivedAt)
    return { label: "Requested pickup", value: order.confirmedPickupAt || order.requestedPickupAt };
  if (order.estimatedReadyAt && ["Queued", "Processing"].includes(shopOrderStatus(order)))
    return { label: "Estimated ready", value: order.estimatedReadyAt };
  if (shopOrderStatus(order) === "Ready" && order.readyAt) return { label: "Ready since", value: order.readyAt };
  return { label: "Placed", value: order.createdAt };
}

export function shopOrderTransport(order: Order) {
  return `${order.collectionMethod === "ShopPickup" ? "Rider pickup" : "Drop-off"} → ${order.deliveryType === "Deliver" ? "Delivery" : "Customer collection"}`;
}
