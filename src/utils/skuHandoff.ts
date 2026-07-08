// Changes: Shared handoff payload from Image Studio to SKU Generator.
import { GeneratedImage } from '../types';
import { PriceMode } from './podPricing';
import { buildBrandSkuContext } from './brandSpecs';

export type SkuHandoff = {
  id: string;
  images: string[];
  priceMode: PriceMode;
  contextText: string;
  contextMode: 'series' | 'template';
  autoGenerate: boolean;
  sourceImageIds: string[];
};

export function createSkuHandoffFromImages(
  studioImages: GeneratedImage[],
  priceMode: PriceMode,
  options: { autoGenerate?: boolean } = {}
): SkuHandoff {
  const { contextText, contextMode } = buildBrandSkuContext(priceMode, studioImages);
  return {
    id: crypto.randomUUID(),
    images: studioImages.map((img) => img.url),
    priceMode,
    contextText,
    contextMode,
    autoGenerate: options.autoGenerate ?? true,
    sourceImageIds: studioImages.map((img) => img.id),
  };
}
