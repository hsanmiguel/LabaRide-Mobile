import { z } from 'zod';

export const signupSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  }).refine(body => body.password === body.confirmPassword, {
    message: 'Passwords do not match', path: ['confirmPassword'],
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  })
});

export const riderSignupSchema = z.object({ body: z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().regex(/^\+?[0-9][0-9\s()-]{8,19}$/, 'Enter a valid contact number'),
  password: z.string().min(6).max(128),
  confirmPassword: z.string().min(1),
}).refine(body => body.password === body.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] }) });
