// Changes: Image Studio → SKU handoff; supports one product with gallery or bulk separate SKUs.
import { GeneratedImage } from '../types';
import { PriceMode } from './podPricing';
import { buildBrandSkuContext } from './brandSpecs';

export type SkuHandoffMode = 'single-product' | 'bulk-products';

export type SkuHandoff = {
  id: string;
  images: string[];
  mode: SkuHandoffMode;
  priceMode: PriceMode;
  contextText: string;
  contextMode: 'series' | 'template';
  autoGenerate: boolean;
  sourceImageIds: string[];
};

export function createSkuHandoffFromImages(
  studioImages: GeneratedImage[],
  priceMode: PriceMode,
  options: { autoGenerate?: boolean; mode?: SkuHandoffMode } = {}
): SkuHandoff {
  const { contextText, contextMode } = buildBrandSkuContext(priceMode, studioImages);
  const mode =
    options.mode ??
    (studioImages.length > 1 ? 'single-product' : 'single-product');

  return {
    id: crypto.randomUUID(),
    images: studioImages.map((img) => img.url),
    mode,
    priceMode,
    contextText,
    contextMode,
    autoGenerate: options.autoGenerate ?? true,
    sourceImageIds: studioImages.map((img) => img.id),
  };
}

export function splitProductImages(previews: string[]): {
  mainImageSrc: string;
  galleryImageSrcs: string[];
} {
  const trimmed = previews.filter(Boolean);
  return {
    mainImageSrc: trimmed[0] || '',
    galleryImageSrcs: trimmed.slice(1),
  };
}
