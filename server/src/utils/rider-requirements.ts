import { z } from 'zod';

export const documentTypes = ['ApplicantPhoto', 'ProfessionalLicense', 'Clearance', 'TinProof', 'OfficialReceipt', 'RegistrationCertificate', 'OwnerAuthorization'] as const;
const documentLabels: Record<string, string> = { ApplicantPhoto: '2×2 applicant photo', ProfessionalLicense: 'Professional driver’s license', Clearance: 'NBI or National Police Clearance', TinProof: 'Proof of TIN', OfficialReceipt: 'Motorcycle official receipt (OR)', RegistrationCertificate: 'Motorcycle registration certificate (CR)', OwnerAuthorization: 'Owner authorization / deed of sale' };
export const documentMeta = { id: true, userId: true, type: true, status: true, reviewReason: true, updatedAt: true, reviewedAt: true } as const;
export function ageOnDate(value: Date | string, today = new Date()) {
  const birth = new Date(value);
  const local = new Date(today.getTime() + 8 * 3600000);
  let age = local.getUTCFullYear() - birth.getUTCFullYear();
  if (local.getUTCMonth() < birth.getUTCMonth() || local.getUTCMonth() === birth.getUTCMonth() && local.getUTCDate() < birth.getUTCDate()) age--;
  return age;
}
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, 'Choose a valid date');
export const riderDetailsSchema = z.object({
  birthdate: date.refine(value => ageOnDate(value) >= 18, 'Applicants must be at least 18 years old'),
  address_line_1: z.string().trim().min(1).max(200), city: z.string().trim().min(1).max(100),
  state_province: z.string().trim().min(1).max(100), postal_code: z.string().trim().min(1).max(20),
  licenseNumber: z.string().trim().min(3).max(50),
  licenseExpiry: date.refine(value => value >= new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10), 'Your professional license must not be expired'),
  motorcycleMake: z.string().trim().min(1).max(80), motorcycleModel: z.string().trim().min(1).max(80),
  motorcycleYear: z.number().int().min(1900).max(new Date().getFullYear() + 1),
  plateNumber: z.string().trim().min(2).max(30), registeredOwner: z.boolean(),
});

type Application = { licenseNumber: string | null; licenseExpiry: Date | null; motorcycleMake: string | null; motorcycleModel: string | null; motorcycleYear: number | null; plateNumber: string | null; registeredOwner: boolean; user: { birthdate: Date | null; address_line_1: string | null; city: string | null; state_province: string | null; postal_code: string | null }; documents: { type: string; status: string }[] };
export function requiredDocuments(registeredOwner: boolean) {
  return documentTypes.filter(type => type !== 'OwnerAuthorization' || !registeredOwner);
}
export function requirementsMissing(profile: Application, verified = false) {
  const missing: string[] = [];
  if (!profile.user.birthdate || !Number.isFinite(profile.user.birthdate.getTime()) || ageOnDate(profile.user.birthdate) < 18) missing.push('Birthdate (18 or older)');
  if (!profile.user.address_line_1 || !profile.user.city || !profile.user.state_province || !profile.user.postal_code) missing.push('Complete home address');
  if (!profile.licenseNumber || !profile.licenseExpiry || profile.licenseExpiry.toISOString().slice(0, 10) < new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)) missing.push('Valid professional license details');
  if (!profile.motorcycleMake || !profile.motorcycleModel || !profile.motorcycleYear || !profile.plateNumber) missing.push('Motorcycle details');
  for (const type of requiredDocuments(profile.registeredOwner)) {
    if (!profile.documents.some(doc => doc.type === type && (verified ? doc.status === 'Verified' : doc.status !== 'Rejected'))) missing.push(`${documentLabels[type]}${verified ? ' (needs verification)' : ''}`);
  }
  return missing;
}
