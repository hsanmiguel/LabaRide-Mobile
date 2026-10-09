import type { Service, Shop } from "./data";

export function laundryWeight(value: string): number | null {
  const input = value.trim();
  if (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(input)) return null;
  const kilos = Number(input);
  return Number.isFinite(kilos) && kilos > 0 ? kilos : null;
}

export function orderPricing(
  weight: string,
  service: Service | null,
  shop: Pick<Shop, "kiloPrices"> | null,
  deliveryType: "Deliver" | "Pickup",
) {
  const kilos = laundryWeight(weight);
  const deliveryFee = deliveryType === "Deliver" ? 30 : 0;
  const matchingRanges = kilos === null ? [] : (shop?.kiloPrices || []).filter(
    (range) => kilos >= Number(range.minKilo) && kilos <= Number(range.maxKilo),
  );
  const rate = matchingRanges.length === 1
    ? Number(matchingRanges[0].pricePerKilo)
    : Number(service?.price);
  const pricingError = matchingRanges.length > 1
    ? "This shop has overlapping weight prices. Ask the shop to correct them before ordering."
    : !service || !Number.isFinite(rate) || rate < 0
      ? "This service has no valid price. Ask the shop to update its prices."
      : null;
  const subtotalCents = kilos === null || pricingError
    ? null
    : Math.round((kilos * rate + Number.EPSILON) * 100);
  const subtotal = subtotalCents === null ? null : subtotalCents / 100;
  return {
    kilos,
    rate: pricingError ? null : rate,
    subtotal,
    deliveryFee,
    discount: 0,
    total: subtotalCents === null ? null : (subtotalCents + deliveryFee * 100) / 100,
    pricingError,
  };
}
