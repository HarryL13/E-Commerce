// Changes: Brand + SKU context presets for Image Studio → SKU Generator handoff (FIG-POD / FIG-NOL).
import { AppTab, GeneratedImage } from '../types';
import { PriceMode } from './podPricing';

const BRAND_BASE = `Jujubit / FIG brand e-commerce standards:
- Product photography: faithful colors, materials, proportions, logos, and surface details from the reference image
- Clean professional presentation suitable for Shopify product listings
- No watermarks, no misleading props, no redesign of the product
- SEO-friendly, premium collectible / designer toy tone`;

const TAB_LABELS: Partial<Record<AppTab, string>> = {
  [AppTab.BACKGROUND]: 'Studio background product shot',
  [AppTab.MULTIVIEW]: 'Multi-angle product view (top / side / detail)',
  [AppTab.SCENE]: 'Lifestyle / scene product shot',
  [AppTab.LOGO]: 'Logo-branded product shot',
};

function describeStudioImage(img: GeneratedImage): string {
  const tabLabel = img.tab ? TAB_LABELS[img.tab] : 'Product image';
  const promptHint = img.prompt?.trim().slice(0, 180);
  return promptHint ? `${tabLabel}. Generation notes: ${promptHint}` : tabLabel;
}

export function buildBrandSkuContext(
  priceMode: PriceMode,
  images: GeneratedImage[]
): { contextText: string; contextMode: 'series' | 'template' } {
  const imageNotes = images.map(describeStudioImage).join('\n- ');

  if (priceMode === 'pod-default') {
    return {
      contextMode: 'series',
      contextText: `${BRAND_BASE}

Series: FIG-POD Print-on-Demand Collection
SKU line: FIG-POD (sizes 4cm–10cm with standard POD pricing)
Title format must use series name "FIG-POD" in the product title.

Visual assets from Image Studio (${images.length} image${images.length > 1 ? 's' : ''} for this listing${images.length > 1 ? ' — first is hero, others are gallery' : ''}):
- ${imageNotes}`,
    };
  }

  return {
    contextMode: 'series',
    contextText: `${BRAND_BASE}

Series: FIG-NOL Bulk / Wholesale Collection
SKU line: FIG-NOL (custom sizes and prices — 大货)
Title format must use series name "FIG-NOL" in the product title.

Visual assets from Image Studio (${images.length} image${images.length > 1 ? 's' : ''} for this listing${images.length > 1 ? ' — first is hero, others are gallery' : ''}):
- ${imageNotes}`,
  };
}
