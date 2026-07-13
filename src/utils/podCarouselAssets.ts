// Changes: Fixed POD carousel tail slides — size guide + create-your-own (last 2 images).

import { PriceMode } from './podPricing';
import { SkuHandoffMode } from './skuHandoff';

export const POD_CAROUSEL_TAIL_COUNT = 2;

/** Max user/product images before appending the 2 fixed POD slides (Shopify limit 10). */
export const MAX_POD_USER_CAROUSEL_IMAGES = 10 - POD_CAROUSEL_TAIL_COUNT;

export const POD_CAROUSEL_TAIL_ASSETS = [
  {
    id: 'size-guide',
    url: '/pod-carousel/pod-size-guide.png',
    label: '尺寸说明',
    filenameSuffix: 'size-guide',
  },
  {
    id: 'create-your-own',
    url: '/pod-carousel/pod-create-your-own.png',
    label: '定制步骤',
    filenameSuffix: 'create-your-own',
  },
] as const;

let cachedTailDataUrls: string[] | null = null;

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read carousel asset'));
    reader.readAsDataURL(blob);
  });
}

/** Load fixed POD carousel slides as data URLs (cached). */
export async function getPodCarouselTailDataUrls(): Promise<string[]> {
  if (cachedTailDataUrls) return [...cachedTailDataUrls];

  const dataUrls = await Promise.all(
    POD_CAROUSEL_TAIL_ASSETS.map(async (asset) => {
      const res = await fetch(asset.url);
      if (!res.ok) throw new Error(`Failed to load ${asset.label}`);
      return blobToDataUrl(await res.blob());
    })
  );

  cachedTailDataUrls = dataUrls;
  return [...dataUrls];
}

export function isPodCarouselTailImage(src: string): boolean {
  if (!src || !cachedTailDataUrls) return false;
  return cachedTailDataUrls.includes(src);
}

export function shouldAppendPodCarouselTail(
  priceMode: PriceMode,
  generationMode: SkuHandoffMode
): boolean {
  return priceMode === 'pod-default' && generationMode === 'single-product';
}

/**
 * Append size guide + create-your-own as the last two carousel images for POD listings.
 */
export async function buildPodCarouselPreviews(
  userPreviews: string[],
  priceMode: PriceMode,
  generationMode: SkuHandoffMode
): Promise<string[]> {
  const trimmed = userPreviews.filter(Boolean);
  if (!shouldAppendPodCarouselTail(priceMode, generationMode)) {
    return trimmed.slice(0, 10);
  }

  const tail = await getPodCarouselTailDataUrls();
  const user = trimmed.slice(0, MAX_POD_USER_CAROUSEL_IMAGES);
  return [...user, ...tail];
}

/** Preload tail assets so UI can detect fixed slides after generate. */
export function preloadPodCarouselTailAssets(): void {
  void getPodCarouselTailDataUrls().catch(() => {
    /* ignore — will retry on generate */
  });
}
