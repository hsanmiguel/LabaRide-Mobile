import { Prisma } from '@prisma/client';

type ServicePrice = { id: number; serviceName: string; price: Prisma.Decimal };
type WeightPrice = { minKilo: Prisma.Decimal; maxKilo: Prisma.Decimal; pricePerKilo: Prisma.Decimal };

export function priceOrder(input: {
  kilos: number;
  serviceIds?: number[];
  serviceName: string;
  services: ServicePrice[];
  ranges: WeightPrice[];
  deliveryType: string;
}) {
  const weight = new Prisma.Decimal(input.kilos);
  const selected = input.serviceIds?.length
    ? input.serviceIds.map((id) => input.services.find((service) => service.id === id))
    : (() => {
        const exact = input.services.find((service) => service.serviceName === input.serviceName);
        return exact ? [exact] : input.serviceName.split(', ').map((name) =>
          input.services.find((service) => service.serviceName === name));
      })();
  if (!selected.length || selected.some((service) => !service)) {
    return { error: 'A selected service is no longer available. Refresh the shop and try again.' } as const;
  }
  const matching = input.ranges.filter((range) =>
    weight.greaterThanOrEqualTo(range.minKilo) && weight.lessThanOrEqualTo(range.maxKilo));
  if (matching.length > 1) {
    return { error: 'This shop has overlapping weight prices. Ask the shop to correct them.' } as const;
  }
  const rate = matching.length
    ? matching[0].pricePerKilo
    : selected.reduce((sum, service) => sum.plus(service!.price), new Prisma.Decimal(0));
  const subtotal = weight.mul(rate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const deliveryFee = new Prisma.Decimal(input.deliveryType === 'Deliver' ? 30 : 0);
  return {
    serviceName: selected.map((service) => service!.serviceName).join(', '),
    subtotal,
    deliveryFee,
    voucherDiscount: new Prisma.Decimal(0),
    totalAmount: subtotal.plus(deliveryFee),
  } as const;
}
