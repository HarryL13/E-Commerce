// Changes: SKU-linked image filenames — handle + position for downloads and Shopify upload.

/** Safe slug for filenames (matches Shopify handle style). */
export function slugifyHandle(handle: string): string {
  return handle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'product';
}

/** e.g. bullet-bandit-01.png (hero = 01, gallery = 02+) */
export function buildSkuImageFilename(handle: string, position: number, ext = 'png'): string {
  const stem = slugifyHandle(handle);
  return `${stem}-${String(position).padStart(2, '0')}.${ext}`;
}

/** Map ordered image ids → filename for a product handle. */
export function buildImageFilenameMap(
  handle: string,
  orderedImageIds: string[]
): Record<string, string> {
  const map: Record<string, string> = {};
  orderedImageIds.forEach((id, index) => {
    map[id] = buildSkuImageFilename(handle, index + 1);
  });
  return map;
}

export function extFromDataUrl(src: string): string {
  if (/image\/jpe?g/i.test(src)) return 'jpg';
  return 'png';
}

export function filenameForDataUrl(handle: string, position: number, src: string): string {
  return buildSkuImageFilename(handle, position, extFromDataUrl(src));
}
