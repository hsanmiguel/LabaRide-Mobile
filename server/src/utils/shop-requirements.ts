export const shopDocumentTypes = ['DTIRegistration', 'SECRegistration', 'TinProof', 'MayorsPermit'] as const;
export const shopDocumentLabels: Record<string, string> = { DTIRegistration: 'DTI registration', SECRegistration: 'SEC registration', TinProof: 'TIN proof', MayorsPermit: "Mayor’s Permit" };
export const shopDocumentMeta = { id: true, type: true, status: true, reviewReason: true, reviewedAt: true, updatedAt: true } as const;
export function shopRequirementsMissing(documents: { type: string; status: string }[], verified = true) {
  const has = (type: string) => documents.some(doc => doc.type === type && (!verified || doc.status === 'Verified'));
  return [...(!has('DTIRegistration') && !has('SECRegistration') ? ['DTI or SEC registration'] : []), ...(!has('TinProof') ? ['TIN proof'] : []), ...(!has('MayorsPermit') ? ["Mayor’s Permit"] : [])];
}
