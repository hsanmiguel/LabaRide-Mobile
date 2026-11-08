import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';

type Pin = { latitude?: unknown; longitude?: unknown };
export type FeeBooking = Pin & { shopId: number; deliveryType: string; collectionMethod: string; collectionAddress?: Pin | null };
export type FeePolicy = { baseFee: unknown; ratePerKm: unknown; minimumFee: unknown; commissionPercent: unknown; revision: number };
export type FeePricing = { baseFee: number; ratePerKm: number; minimumFee: number; commissionPercent: number; revision: number;
  pickupKm: number; returnKm: number; distanceKm: number; deliveryFee: number; commission: number; pickupEarnings: number; returnEarnings: number; provider: string };
export function feeError(message: string): never { throw Object.assign(new Error(message), { statusCode: 409 }); }
export function pin(value: Pin) {
  if (value.latitude == null || value.longitude == null || value.latitude === '' || value.longitude === '') feeError('Pin the customer and shop locations before calculating delivery fees.');
  const latitude = Number(value.latitude), longitude = Number(value.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) feeError('Choose valid map locations.');
  return [longitude, latitude];
}
export function feeFingerprint(booking: FeeBooking, shop: Pin) {
  // Only transport changes invalidate the delivery quote. Laundry weight and rider identity do not.
  return createHash('sha256').update(JSON.stringify([booking.shopId, booking.collectionMethod, booking.deliveryType,
    pin(shop), booking.collectionMethod === 'ShopPickup' ? pin(booking.collectionAddress || {}) : null,
    booking.deliveryType === 'Deliver' ? pin(booking) : null])).digest('hex');
}
export function calculateFee(policy: FeePolicy, pickupKm: number, returnKm: number, pickup: boolean, delivery: boolean): FeePricing {
  const D = Prisma.Decimal;
  if (![pickupKm, returnKm].every(n => Number.isFinite(n) && n >= 0)) feeError('Road distance is unavailable.');
  const distanceKm = pickupKm + returnKm;
  const fee = pickup || delivery ? D.max(new D(String(policy.minimumFee)), new D(String(policy.baseFee)).plus(new D(distanceKm).mul(String(policy.ratePerKm)))).toDecimalPlaces(2) : new D(0);
  if (fee.greaterThan('99999999.99')) feeError('The delivery fee exceeds the supported booking limit. Check the route and delivery rates.');
  const commission = fee.mul(String(policy.commissionPercent)).div(100).toDecimalPlaces(2);
  const pool = fee.minus(commission);
  const pickupEarnings = !pickup ? new D(0) : !delivery ? pool : (distanceKm ? pool.mul(pickupKm).div(distanceKm) : pool.div(2)).toDecimalPlaces(2);
  return { baseFee: Number(policy.baseFee), ratePerKm: Number(policy.ratePerKm), minimumFee: Number(policy.minimumFee), commissionPercent: Number(policy.commissionPercent), revision: policy.revision,
    pickupKm, returnKm, distanceKm, deliveryFee: fee.toNumber(), commission: commission.toNumber(), pickupEarnings: pickupEarnings.toNumber(), returnEarnings: pool.minus(pickupEarnings).toNumber(), provider: 'mapbox/driving' };
}
export async function roadKilometers(from: Pin, to: Pin, request: typeof fetch = fetch) {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) feeError('Road-distance pricing is not configured. Please contact support.');
  const coordinates = `${pin(from).join(',')};${pin(to).join(',')}`;
  try {
    const response = await request(`https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?overview=false&alternatives=false&access_token=${encodeURIComponent(token!)}`, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Routing unavailable');
    const result = await response.json() as { code?: string; routes?: { distance: number }[]; waypoints?: { distance: number }[] };
    const meters = result.routes?.[0]?.distance;
    if (result.code !== 'Ok' || typeof meters !== 'number' || !Number.isFinite(meters) || meters < 0 || result.waypoints?.some(point => point.distance > 1000)) throw new Error('No usable route');
    return meters / 1000;
  } catch { return feeError('Unable to calculate a driving route. Check the map pins and retry. No estimated fee has been charged.'); }
}
export function stageEarnings(pricing: unknown, stage: string): number | null {
  if (!pricing || typeof pricing !== 'object') return null;
  const value = (pricing as FeePricing)[stage === 'Pickup' ? 'pickupEarnings' : 'returnEarnings'];
  return typeof value === 'number' ? value : null;
}
