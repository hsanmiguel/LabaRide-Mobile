export function dialablePhone(value: string) {
  const number = value.trim().replace(/[\s().-]/g, '');
  return /^\+?\d{7,15}$/.test(number) ? number : null;
}

export async function openPhoneApp(value: string, openURL: (url: string) => Promise<unknown>) {
  const number = dialablePhone(value);
  if (!number) throw new Error('This contact does not have a valid phone number. Ask the customer or shop to update their contact details.');
  await openURL(`tel:${number}`);
}
