import { z } from 'zod';

export const approvalStatus = z.enum(['Pending', 'Approved', 'Rejected', 'Suspended']);
export const reviewShopSchema = z.object({
  params: z.object({ shopId: z.coerce.number().int().positive() }),
  body: z.object({
    status: z.enum(['Approved', 'Rejected', 'Suspended']),
    expectedStatus: approvalStatus,
    expectedVersion: z.number().int().positive(),
    reason: z.string().trim().max(1000).optional(),
  }).superRefine((body, ctx) => {
    if (body.status !== 'Approved' && !body.reason) ctx.addIssue({
      code: z.ZodIssueCode.custom, path: ['reason'], message: 'Explain the reason for this decision',
    });
    const allowed = body.status === 'Approved' ? ['Pending', 'Suspended'] : body.status === 'Rejected' ? ['Pending'] : ['Approved'];
    if (!allowed.includes(body.expectedStatus)) ctx.addIssue({
      code: z.ZodIssueCode.custom, path: ['status'], message: 'This decision is not available for the current shop status',
    });
  }),
});
