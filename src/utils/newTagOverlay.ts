// Changes: NEW badge overlay for Multi-View SKU compositing — toggle, scale, auto text color.

import { SkuBaseVariant } from './skuBaseTemplates';

export type NewTagTextVariant = 'black' | 'white';

export const NEW_TAG_PREF_ENABLED = 'ecs_multiview_new_tag_enabled';
export const NEW_TAG_PREF_SCALE = 'ecs_multiview_new_tag_scale';

/** Badge width as fraction of canvas width (0.1–0.4). */
export const NEW_TAG_SCALE_MIN = 10;
export const NEW_TAG_SCALE_MAX = 40;
export const NEW_TAG_SCALE_DEFAULT = 20;

export const NEW_TAG_ASSETS: Record<
  NewTagTextVariant,
  { url: string; label: string }
> = {
  black: {
    url: '/sku-templates/new-tag-black-text.png',
    label: '黑字 NEW',
  },
  white: {
    url: '/sku-templates/new-tag-white-text.png',
    label: '白字 NEW',
  },
};

export type NewTagOverlayOptions = {
  enabled: boolean;
  /** Badge width as % of canvas width. */
  scalePercent: number;
};

export function newTagVariantForSkuBase(base: SkuBaseVariant): NewTagTextVariant {
  return base === 'white' ? 'black' : 'white';
}

export function readNewTagEnabled(): boolean {
  try {
    return localStorage.getItem(NEW_TAG_PREF_ENABLED) === '1';
  } catch {
    return false;
  }
}

export function writeNewTagEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(NEW_TAG_PREF_ENABLED, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function readNewTagScale(): number {
  try {
    const raw = localStorage.getItem(NEW_TAG_PREF_SCALE);
    const n = raw ? Number(raw) : NEW_TAG_SCALE_DEFAULT;
    if (!Number.isFinite(n)) return NEW_TAG_SCALE_DEFAULT;
    return Math.min(NEW_TAG_SCALE_MAX, Math.max(NEW_TAG_SCALE_MIN, Math.round(n)));
  } catch {
    return NEW_TAG_SCALE_DEFAULT;
  }
}

export function writeNewTagScale(scale: number): void {
  try {
    localStorage.setItem(NEW_TAG_PREF_SCALE, String(scale));
  } catch {
    /* ignore */
  }
}

export function buildNewTagOptions(
  enabled: boolean,
  scalePercent: number,
  skuBase: SkuBaseVariant
): NewTagOverlayOptions & { variant: NewTagTextVariant } {
  return {
    enabled,
    scalePercent,
    variant: newTagVariantForSkuBase(skuBase),
  };
}
