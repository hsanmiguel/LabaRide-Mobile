import { z } from 'zod';
import { addressSchema } from './address.validator';

export const createTransactionSchema = z.object({
  body: z.object({
    shopId: z.number().int().positive(),
    serviceName: z.string().min(1),
    serviceIds: z.array(z.number().int().positive()).min(1).refine(
      (ids) => new Set(ids).size === ids.length, 'Select each service only once',
    ).optional(),
    kiloAmount: z.number().finite().positive().refine(
      (value) => Number(value.toFixed(2)) === value,
      'Enter a weight with up to two decimal places',
    ),
    // Kept for existing clients; the server calculates all prices from the shop.
    subtotal: z.number().optional(),
    deliveryFee: z.number().optional(),
    voucherDiscount: z.number().optional(),
    totalAmount: z.number().optional(),
    deliveryType: z.enum(['Deliver', 'Pickup']),
    ...addressSchema.shape,
    scheduledDate: z.string(), // ISO String
    scheduledTime: z.string(), // ISO String
    paymentMethod: z.string().default('Cash on Delivery'),
    notes: z.string().optional(),
    items: z.array(z.object({
      itemName: z.string(),
      quantity: z.number().int().positive()
    })).optional()
  })
});

export const updateStatusSchema = z.object({
  body: z.object({
    status: z.enum(['Pending', 'Processing', 'Completed', 'Cancelled']),
    notes: z.string().optional()
  })
});

export const cancelTransactionSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    // Older clients can omit the reason; supplied reasons must contain text.
    reason: z.string().trim().min(1, 'Choose a cancellation reason').max(500).optional(),
  }),
});
