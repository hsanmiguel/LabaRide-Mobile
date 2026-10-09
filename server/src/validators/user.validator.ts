import { z } from 'zod';
import { addressSchema } from './address.validator';

export const updateUserSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').optional(),
    phone: z.string().optional(),
    birthdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid birthdate').refine(value => {
      const date = new Date(value);
      return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }, 'Choose a valid calendar date').optional(),
    gender: z.string().optional(),
    zone: z.string().optional(),
    street: z.string().optional(),
    barangay: z.string().optional(),
    building: z.string().optional(),
    ...addressSchema.partial().shape,
  }).superRefine((body, ctx) => {
    // Personal details may be edited independently. Saving an address requires all routing fields.
    if (Object.keys(addressSchema.shape).some(key => key in body)) {
      const result = addressSchema.safeParse(body);
      if (!result.success) result.error.issues.forEach(issue => ctx.addIssue(issue));
    }
  })
});

export const updatePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  })
});
