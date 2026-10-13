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
  shop: Pick<Shop, "kiloPrices" | "services"> | null,
  deliveryType: "Deliver" | "Pickup",
  serviceIds?: number[],
) {
  const kilos = laundryWeight(weight);
  const deliveryFee = deliveryType === "Deliver" ? 30 : 0;
  const selected = serviceIds?.length
    ? serviceIds.map((id) => shop?.services?.find((item) => item.id === id))
    : service ? [service] : [];
  const perKiloServices = selected.filter((item) => item && item.packageKilos == null);
  const packages = selected.filter((item): item is Service => !!item && item.packageKilos != null);
  const matchingRanges = kilos === null ? [] : (shop?.kiloPrices || []).filter(
    (range) => kilos >= Number(range.minKilo) && kilos <= Number(range.maxKilo),
  );
  const rate = matchingRanges.length === 1
    ? Number(matchingRanges[0].pricePerKilo)
    : perKiloServices.reduce((sum, item) => sum + Number(item!.price), 0);
  const pricingError = !selected.length || selected.some((item) => !item || !Number.isFinite(Number(item.price)) || Number(item.price) < 0)
    ? "This service has no valid price. Ask the shop to update its prices."
    : packages.some((item) => !Number.isFinite(Number(item.packageKilos)) || Number(item.packageKilos) <= 0)
      ? "This service has an invalid package weight. Ask the shop to update it."
    : perKiloServices.length && matchingRanges.length > 1
    ? "This shop has overlapping weight prices. Ask the shop to correct them before ordering."
    : perKiloServices.length && (!Number.isFinite(rate) || rate < 0)
      ? "This service has no valid price. Ask the shop to update its prices."
      : null;
  const packageLoads = packages.map((item) => ({
    serviceName: item.serviceName,
    packageKilos: Number(item.packageKilos),
    price: Number(item.price),
    // Integer hundredths avoid floating-point errors at load boundaries.
    loads: kilos === null ? null : Math.ceil(Math.round(kilos * 100) / Math.round(Number(item.packageKilos) * 100)),
  }));
  const packageCents = packageLoads.reduce((sum, item) => sum + (item.loads || 0) * Math.round(item.price * 100), 0);
  const subtotalCents = kilos === null || pricingError
    ? null
    : packageCents + (perKiloServices.length ? Math.round(Math.round(kilos * 100) * Math.round(rate * 100) / 100) : 0);
  const subtotal = subtotalCents === null ? null : subtotalCents / 100;
  return {
    kilos,
    rate: pricingError || !perKiloServices.length ? null : rate,
    packageLoads,
    subtotal,
    deliveryFee,
    discount: 0,
    total: subtotalCents === null ? null : (subtotalCents + deliveryFee * 100) / 100,
    pricingError,
  };
}
