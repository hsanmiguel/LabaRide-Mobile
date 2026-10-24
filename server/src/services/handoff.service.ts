export type HandoffOrder = { workflowStatus: string | null; assignments: { id: number; riderId: number; stage: string; status: string }[] };
type HandoffEvent = { action: string; detail: string | null };

export function handoffState(order: HandoffOrder, events: HandoffEvent[]) {
  const kind = order.workflowStatus === 'PickupEnRoute' ? 'pickup' : order.workflowStatus === 'DeliveryAccepted' ? 'collection' : order.workflowStatus === 'OutForDelivery' ? 'delivery' : undefined;
  const job = kind && order.assignments.find(job => job.status === 'Accepted' && job.stage === (kind === 'pickup' ? 'Pickup' : 'Delivery'));
  if (!job || !kind) return undefined;
  const marker = `Assignment #${job.id} · ${kind} handover`;
  const relevant = events.filter(event => event.detail === marker);
  return { kind, riderId: job.riderId, marker, arrived: relevant.some(event => event.action === 'HandoffArrived'), released: relevant.some(event => event.action === 'HandoffReleased') };
}
