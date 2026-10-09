import { z } from 'zod';

export const addressSchema = z.object({
  address_line_1: z.string().trim().min(1, 'Street number and street name are required'),
  address_line_2: z.string().trim().optional(),
  city: z.string().trim().min(1, 'City or municipality is required'),
  state_province: z.string().trim().min(1, 'State, province, or region is required'),
  postal_code: z.string().trim().min(1, 'ZIP or postal code is required'),
  country: z.string().trim().min(1, 'Country is required'),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
  address_type: z.enum(['Home', 'Work', 'Hotel', 'Apartment']),
  access_code: z.string().trim().optional(),
  dropoff_instructions: z.string().trim().optional(),
});

export const addressSelect = Object.fromEntries(
  Object.keys(addressSchema.shape).map(key => [key, true]),
) as { [K in keyof z.infer<typeof addressSchema>]: true };

export function formatAddress(value: z.infer<typeof addressSchema>) {
  return [value.address_line_1, value.address_line_2, value.city,
  value.state_province, value.postal_code, value.country].filter(Boolean).join(', ');
}
