export const orderDetailSteps = [
  { title: "Booking", description: "Review and confirm the booking." },
  { title: "Received", description: "Arrange collection and confirm the laundry has reached the shop." },
  { title: "Processing", description: "Follow washing, drying and folding." },
  { title: "Return", description: "Hand over clean laundry for delivery or customer collection." },
  { title: "Complete", description: "The customer has received their clean laundry." },
] as const;

export function orderDetailProgress(status: string, events: { toStatus: string }[] = []) {
  const cancelled = status === "Cancelled";
  const stage = cancelled ? [...events].reverse().find(event => event.toStatus !== "Cancelled")?.toStatus || "BookingPending" : status;
  const current = stage === "Completed" ? 4
    : ["ReadyForCollection", "ReadyForDelivery", "DeliveryAssigned", "DeliveryAccepted", "CleanLaundryCollected", "OutForDelivery", "Delivered"].includes(stage) ? 3
    : ["Washing", "Drying", "Folding"].includes(stage) ? 2
    : ["PickupQueued", "PickupAssigned", "PickupAccepted", "PickupEnRoute", "LaundryPickedUp", "AtPartner", "LaundryReceived"].includes(stage) ? 1 : 0;
  return { current, cancelled, complete: status === "Completed" };
}

export function originalOrderDetailProgress(order: {
  status: string; receivedAt?: string | null; processingStartedAt?: string | null; readyAt?: string | null;
}) {
  const stages: Record<string, number> = { Pending: 0, Accepted: 1, Queued: 1, Processing: 2, Ready: 3, Completed: 4 };
  const cancelled = order.status === "Cancelled";
  // Earlier orders have no workflow event history. Use only recorded milestones
  // to show where a cancelled order stopped, never imply that it was completed.
  const current = cancelled ? order.readyAt ? 3 : order.processingStartedAt ? 2 : order.receivedAt ? 1 : 0 : stages[order.status] ?? 0;
  return { current, cancelled, complete: order.status === "Completed" };
}
