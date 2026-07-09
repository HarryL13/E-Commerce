// Changes: Handoff carries SKU line (POD/大货), selection order, and image filename map.
import { GeneratedImage } from '../types';
import { PriceMode, priceModeFromSkuLine } from './podPricing';
import { buildBrandSkuContextForLine } from './brandSpecs';
import { SkuLine } from './unifiedHistory';
import { buildImageFilenameMap } from './imageNaming';

export type SkuHandoffMode = 'single-product' | 'bulk-products';

export type SkuHandoff = {
  id: string;
  images: string[];
  mode: SkuHandoffMode;
  priceMode: PriceMode;
  skuLine: SkuLine;
  contextText: string;
  contextMode: 'series' | 'template';
  autoGenerate: boolean;
  /** Selection order — first = hero, rest = gallery */
  sourceImageIds: string[];
  /** Preliminary filenames from handle placeholder; updated after AI generates handle */
  imageFileNames?: Record<string, string>;
};

export function createSkuHandoffFromImages(
  studioImages: GeneratedImage[],
  skuLine: SkuLine,
  options: { autoGenerate?: boolean; mode?: SkuHandoffMode; draftHandle?: string } = {}
): SkuHandoff {
  const priceMode = priceModeFromSkuLine(skuLine);
  const { contextText, contextMode } = buildBrandSkuContextForLine(skuLine, studioImages);
  const mode = options.mode ?? 'single-product';
  const sourceImageIds = studioImages.map((img) => img.id);
  const draftHandle = options.draftHandle || `draft-${Date.now()}`;

  return {
    id: crypto.randomUUID(),
    images: studioImages.map((img) => img.url),
    mode,
    priceMode,
    skuLine,
    contextText,
    contextMode,
    autoGenerate: options.autoGenerate ?? true,
    sourceImageIds,
    imageFileNames: buildImageFilenameMap(draftHandle, sourceImageIds),
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

export function orderedImagesFromSelection(
  allImages: GeneratedImage[],
  selectionOrder: string[]
): GeneratedImage[] {
  const byId = new Map(allImages.map((img) => [img.id, img]));
  return selectionOrder.map((id) => byId.get(id)).filter(Boolean) as GeneratedImage[];
}
