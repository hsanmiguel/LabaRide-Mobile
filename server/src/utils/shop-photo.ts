import sharp from 'sharp';
import { z } from 'zod';

export const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
export const shopPhotoSelection = { select: { updatedAt: true } } as const;

// Listing responses contain only the URL/version, never image bytes.
export function withShopPhoto<T extends { id: number; photo?: { updatedAt: Date } | null }>(shop: T) {
  const { photo, ...details } = shop;
  return { ...details, photoUrl: photo ? `/api/shops/${shop.id}/photo?v=${photo.updatedAt.getTime()}` : null };
}

export const shopPhotoInput = z.object({
  imageBase64: z.string().min(4).max(4 * Math.ceil(MAX_PHOTO_BYTES / 3))
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'Choose a valid image file')
    .refine(value => value.length % 4 === 0, 'Choose a valid image file'),
});

export async function prepareShopPhoto(body: unknown): Promise<Buffer> {
  const { imageBase64 } = shopPhotoInput.parse(body);
  const input = Buffer.from(imageBase64, 'base64');
  if (input.toString('base64') !== imageBase64) throw Object.assign(new Error('Choose a valid image file.'), { statusCode: 400 });
  if (!input.length || input.length > MAX_PHOTO_BYTES) throw Object.assign(new Error('Choose an image smaller than 6 MB.'), { statusCode: 413 });
  try {
    const options = { limitInputPixels: 32_000_000, failOn: 'warning' as const };
    const metadata = await sharp(input, options).metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format || '') || (metadata.pages || 1) !== 1) {
      throw new Error('Unsupported image');
    }
    // Decode, orient, downsize and re-encode. EXIF/location data is not retained.
    return await sharp(input, options).rotate().resize({ width: 1440, height: 1080, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  } catch {
    throw Object.assign(new Error('Choose a valid JPG, PNG or WebP photo, up to 6 MB and 32 megapixels.'), { statusCode: 400 });
  }
}
