const identityFields = [
  'shopName', 'address_line_1', 'address_line_2', 'city',
  'state_province', 'postal_code', 'country', 'latitude', 'longitude',
] as const;
type ShopIdentity = Partial<Record<typeof identityFields[number], unknown>>;

export function shopChangesRequireReview(current: ShopIdentity, changes: ShopIdentity) {
  return identityFields.some(field => {
    // Omitted optional fields are left unchanged by Prisma.
    if (changes[field] === undefined) return false;
    const normalize = (value: unknown) => {
      if (value == null || value === '') return '';
      if (field === 'latitude' || field === 'longitude') return Number(value).toFixed(7);
      return String(value).trim().replace(/\s+/g, ' ').toLowerCase();
    };
    return normalize(current[field]) !== normalize(changes[field]);
  });
}
