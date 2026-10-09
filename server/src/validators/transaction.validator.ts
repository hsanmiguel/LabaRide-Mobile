import { z } from 'zod';
import { addressSchema } from './address.validator';

export const createTransactionSchema = z.object({
  body: z.object({
    shopId: z.number(),
    serviceName: z.string(),
    kiloAmount: z.number(),
    subtotal: z.number(),
    deliveryFee: z.number(),
    voucherDiscount: z.number().default(0),
    totalAmount: z.number(),
    deliveryType: z.string(),
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
