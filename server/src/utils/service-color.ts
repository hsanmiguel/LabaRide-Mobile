import { Prisma } from '@prisma/client';
import prisma from '../config/database';

export function normalizeServiceColor(color: string) {
  const value = color.trim().toUpperCase();
  return value.length === 4 ? '#' + value.slice(1).split('').map(part => part + part).join('') : value;
}

export async function withUniqueServiceColor<T>(shopId: number, color: string | undefined, serviceId: number | undefined,
  write: (tx: Prisma.TransactionClient, assignedColor?: string) => Promise<T>): Promise<T> {
  // Older clients can update a service without changing its color. New services
  // without a color receive an unused option instead of reusing the fallback.
  if (!color && serviceId) return write(prisma);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM shops WHERE id = ${shopId} FOR UPDATE`;
    const others = await tx.shopService.findMany({ where: { shopId, ...(serviceId ? { id: { not: serviceId } } : {}) }, select: { color: true } });
    const used = new Set(others.map(service => normalizeServiceColor(service.color || '#321078')));
    const assignedColor = color || ['#321078', '#6842D9', '#886AB8', '#D0C1E8', '#7EA8BE', '#28536B', '#5C374C', '#052F5F'].find(option => !used.has(option));
    if (!assignedColor || used.has(assignedColor)) {
      throw Object.assign(new Error('This color is already used by another service. Choose a different color.'), { statusCode: 409 });
    }
    return write(tx, assignedColor);
  });
}
