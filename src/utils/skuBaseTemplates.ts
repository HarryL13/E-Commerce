// Changes: Standardized SKU base templates (white/black) for Multi-View compositing.

export type SkuBaseVariant = 'white' | 'black';

export const SKU_BASE_PREF_KEY = 'ecs_multiview_sku_base';

export const SKU_BASE_TEMPLATES: Record<
  SkuBaseVariant,
  { url: string; label: string; labelZh: string }
> = {
  white: {
    url: '/sku-templates/white.png',
    label: 'White',
    labelZh: '白底',
  },
  black: {
    url: '/sku-templates/black.png',
    label: 'Black',
    labelZh: '黑底',
  },
};

export function readSkuBasePreference(): SkuBaseVariant {
  try {
    const saved = localStorage.getItem(SKU_BASE_PREF_KEY);
    return saved === 'black' ? 'black' : 'white';
  } catch {
    return 'white';
  }
}

export function writeSkuBasePreference(variant: SkuBaseVariant): void {
  try {
    localStorage.setItem(SKU_BASE_PREF_KEY, variant);
  } catch {
    /* ignore */
  }
}
