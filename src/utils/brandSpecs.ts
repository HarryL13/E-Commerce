// Changes: POD product title uses JuJuBit pipe format (Name | Tagline); FIG-POD only in variant SKUs.
import { AppTab, GeneratedImage } from '../types';
import { PriceMode, skuLineFromPriceMode } from './podPricing';
import { SkuLine } from './unifiedHistory';

const BRAND_BASE = `Jujubit / FIG brand e-commerce standards:
- Product photography: faithful colors, materials, proportions, logos, and surface details from the reference image
- Clean professional presentation suitable for Shopify product listings
- No watermarks, no misleading props, no redesign of the product
- SEO-friendly, premium collectible / designer toy tone`;

const POD_TITLE_EXAMPLES = `Store title examples (follow this style exactly):
- "Custom Figurine of Yourself | Turn Your Photo into a 3D Printed Figure"
- "Custom TRPG Miniature | Create Your Own Tabletop RPG Character Figure"
- "Custom Hogwarts Student Figurine | Create Your Own 3D Printed Collectible Figure"`;

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
  const skuLine = skuLineFromPriceMode(priceMode);
  return buildBrandSkuContextForLine(skuLine, images);
}

export function buildBrandSkuContextForLine(
  skuLine: SkuLine,
  images: GeneratedImage[]
): { contextText: string; contextMode: 'series' | 'template' } {
  const imageNotes = images.map(describeStudioImage).join('\n- ');

  if (skuLine === 'pod') {
    return {
      contextMode: 'series',
      contextText: `${BRAND_BASE}

Series: FIG-POD Print-on-Demand (POD)
Variant SKU format: FIG-POD-{size} only (sizes 4cm–10cm, standard POD pricing)
IMPORTANT: "FIG-POD" is for variant SKUs only — NEVER put "FIG-POD" in the product title.

Product title format (JuJuBit store style):
"[Character/Product Descriptor] | [Marketing tagline about custom 3D printed figurine]"
${POD_TITLE_EXAMPLES}

Visual assets from Image Studio (${images.length} image${images.length > 1 ? 's' : ''} — first selected is hero, others are gallery carousel):
- ${imageNotes}`,
    };
  }

  return {
    contextMode: 'series',
    contextText: `${BRAND_BASE}

Series: 大货 Bulk / Wholesale (REG SKU)
Variant SKU format: {PRODUCT}-REG-{size} or {PRODUCT}-REG-{sub}-{size}
Product title: descriptive name only (e.g. "Tactical Operator Action Figure")
- Do NOT use FIG-POD, REG, or SKU codes in the title

Visual assets from Image Studio (${images.length} image${images.length > 1 ? 's' : ''} — first selected is hero, others are gallery carousel):
- ${imageNotes}`,
  };
}

