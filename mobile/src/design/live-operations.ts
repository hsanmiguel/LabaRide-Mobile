import type { Order } from "./data";
import { shopOrderStatus } from "./shop-orders";

export const operationStages = [
  { id: "awaiting", title: "Awaiting laundry", description: "Bookings, pickups & arrivals", empty: "No laundry awaiting arrival." },
  { id: "queue", title: "In queue", description: "Received & waiting to start", empty: "Nothing waiting in the queue." },
  { id: "processing", title: "Processing", description: "Washing, drying & folding", empty: "No laundry being processed." },
  { id: "ready", title: "Ready for return", description: "Customer collection or rider handover", empty: "No orders ready for return." },
  { id: "returning", title: "Returning", description: "With rider or awaiting confirmation", empty: "No return deliveries in progress." },
] as const;
export type OperationStage = (typeof operationStages)[number]["id"];

export function operationStage(order: Order): OperationStage | null {
  const status = shopOrderStatus(order);
  if (status === "Completed" || status === "Cancelled") return null;
  if (["CleanLaundryCollected", "OutForDelivery", "Delivered"].includes(order.workflowStatus || "")) return "returning";
  if (status === "Ready") return "ready";
  if (status === "Processing") return "processing";
  if (status === "Queued") return "queue";
  return "awaiting";
}

export function operationOrders(orders: Order[], query = "", service = "") {
  const search = query.trim().toLowerCase().replace(/^#/, "");
  return orders.filter(order => operationStage(order) !== null && (!service || order.serviceName === service) &&
    `${order.id} ${order.userName} ${order.serviceName}`.toLowerCase().includes(search))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id);
}

export function pastReadyEstimate(order: Order, now: number) {
  const stage = operationStage(order);
  return (stage === "queue" || stage === "processing") && !!order.estimatedReadyAt && Date.parse(order.estimatedReadyAt) < now;
}

export function operationTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString("en-PH", {
    timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}
