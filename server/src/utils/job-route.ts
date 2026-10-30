import { dispatchPoint } from '../services/dispatch.service';

export function jobRouteEndpoints(order: {
  id: number; workflowStatus: string | null; workflowVersion: number;
  collectionMethod?: string; collectionAddress?: unknown;
  latitude?: unknown; longitude?: unknown;
  shop: { latitude?: unknown; longitude?: unknown };
}) {
  const stage = order.workflowStatus === 'PickupQueued' ? 'Pickup' as const : 'Delivery' as const;
  const collection = order.collectionAddress && typeof order.collectionAddress === 'object' && !Array.isArray(order.collectionAddress)
    ? order.collectionAddress as { latitude?: unknown; longitude?: unknown } : {};
  const customer = dispatchPoint(stage === 'Pickup' && order.collectionMethod === 'ShopPickup' ? collection : order);
  const shop = dispatchPoint(order.shop);
  return { orderId: order.id, workflowVersion: order.workflowVersion, stage,
    origin: (stage === 'Pickup' ? customer : shop) || null,
    destination: (stage === 'Pickup' ? shop : customer) || null,
    missingPins: [...(!customer ? ['customer' as const] : []), ...(!shop ? ['shop' as const] : [])],
  };
}
