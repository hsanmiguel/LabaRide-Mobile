import { z } from 'zod';

export const registerShopSchema = z.object({
  body: z.object({
    shopName: z.string().min(2, 'Shop name is required'),
    contactNumber: z.string().min(1, 'Contact number is required'),
    zone: z.string().min(1, 'Zone is required'),
    street: z.string().min(1, 'Street is required'),
    barangay: z.string().min(1, 'Barangay is required'),
    building: z.string().optional(),
    openingTime: z.string().min(1, 'Opening time is required'),
    closingTime: z.string().min(1, 'Closing time is required'),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    address: z.string().optional(),
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
