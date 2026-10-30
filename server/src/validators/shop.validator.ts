import { z } from 'zod';
import { addressSchema } from './address.validator';
import { distanceSettingsError } from '../utils/service-area';
import { businessMinutes } from '../utils/shop-hours';

const distance = z.number().finite().min(0).max(99999.99).refine(
  value => Number(value.toFixed(2)) === value, 'Use up to two decimal places for distances',
).nullable().optional();

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
    deliveryMinKm: distance,
    deliveryMaxKm: distance,
    pickupMinKm: distance,
    pickupMaxKm: distance,
    pickupEnabled: z.boolean().optional(),
    acceptingOrders: z.boolean().optional(),
    ...addressSchema.shape,
  }).superRefine((data, ctx) => {
    if (businessMinutes(data.openingTime) === businessMinutes(data.closingTime)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Opening and closing times must be different.', path: ['closingTime'] });
    }
    const error = distanceSettingsError(data);
    if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error, path: ['deliveryMinKm'] });
  })
});

export const createServiceSchema = z.object({
  body: z.object({
    serviceName: z.string().trim().min(1, 'Service name is required'),
    price: z.number().finite().min(0, 'Price cannot be negative').max(99999999.99).refine(
      (value) => Number(value.toFixed(2)) === value, 'Enter a price with up to two decimal places',
    ),
    packageKilos: z.number().finite().positive('Package weight must be above 0 kg').max(99999999.99).refine(
      (value) => Number(value.toFixed(2)) === value, 'Enter a weight with up to two decimal places',
    ).nullable().optional(),
    color: z.string().trim().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Choose a valid service color').transform(value => {
      const hex = value.toUpperCase();
      return hex.length === 4 ? '#' + hex.slice(1).split('').map(part => part + part).join('') : hex;
    }).optional(),
  })
});

export const createKiloPriceSchema = z.object({
  body: z.object({
    minKilo: z.number().min(0),
    maxKilo: z.number().min(0),
    pricePerKilo: z.number().min(0),
  }).refine((range) => range.maxKilo > range.minKilo, {
    message: 'Maximum weight must be greater than minimum weight',
    path: ['maxKilo'],
  })
});

export const createItemSchema = z.object({
  body: z.object({
    itemName: z.string().min(1, 'Item name is required'),
    price: z.number().min(0, 'Price must be positive'),
  })
});
