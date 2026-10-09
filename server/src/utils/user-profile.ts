import { addressSelect } from '../validators/address.validator';

// Keep every profile response consistent, and never return password hashes.
export const userProfileSelect = {
  id: true, name: true, email: true, phone: true, birthdate: true,
  gender: true, zone: true, street: true, barangay: true, building: true,
  ...addressSelect, isShopOwner: true, createdAt: true, updatedAt: true,
} as const;
