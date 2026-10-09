import { z } from 'zod';
import { addressSchema } from './address.validator';

const businessTime = z.string().trim().regex(
  /^(?:(?:[01]?\d|2[0-3]):[0-5]\d|(?:0?[1-9]|1[0-2]):[0-5]\d\s*(?:AM|PM))$/i,
  'Choose a valid business time',
);

export const registerShopSchema = z.object({
  body: z.object({
    shopName: z.string().trim().min(2, 'Shop name must have at least 2 characters'),
    contactNumber: z.string().trim().min(1, 'Contact number is required'),
    openingTime: businessTime,
    closingTime: businessTime,
    ...addressSchema.shape,
  })
});

export const createServiceSchema = z.object({
  body: z.object({
    serviceName: z.string().min(1, 'Service name is required'),
    price: z.number().min(0, 'Price must be positive'),
    color: z.string().optional(),
  })
});

export const createKiloPriceSchema = z.object({
  body: z.object({
    minKilo: z.number().min(0),
    maxKilo: z.number().min(0),
    pricePerKilo: z.number().min(0),
  })
});

export const createItemSchema = z.object({
  body: z.object({
    itemName: z.string().min(1, 'Item name is required'),
    price: z.number().min(0, 'Price must be positive'),
  })
});
