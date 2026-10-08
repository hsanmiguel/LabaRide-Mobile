import { z } from 'zod';

export const updateUserSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').optional(),
    phone: z.string().optional(),
    birthdate: z.string().optional(), // Expecting ISO date string or YYYY-MM-DD
    gender: z.string().optional(),
    zone: z.string().optional(),
    street: z.string().optional(),
    barangay: z.string().optional(),
    building: z.string().optional(),
  })
});

export const updatePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  })
});
