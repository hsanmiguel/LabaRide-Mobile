import { addressSelect } from '../validators/address.validator';

// Keep every profile response consistent, and never return password hashes.
export const userProfileSelect = {
  id: true, name: true, email: true, phone: true, birthdate: true,
  gender: true, zone: true, street: true, barangay: true, building: true,
  ...addressSelect, isShopOwner: true, createdAt: true, updatedAt: true,
  photo: { select: { updatedAt: true } },
} as const;

export function withUserPhoto<T extends { id: number; photo?: { updatedAt: Date } | null }>(user: T) {
  const { photo, ...details } = user;
  return { ...details, photoUrl: photo ? `/api/users/${user.id}/photo?v=${photo.updatedAt.getTime()}` : null };
}
