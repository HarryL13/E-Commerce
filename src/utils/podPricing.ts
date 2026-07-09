// Changes: POD = FIG-POD-{size}; 大货 = {code}-REG-{size} or {code}-REG-{sub}-{size}.
import { Variant } from './csvExport';

export const POD_SIZES = ['4cm', '5cm', '6cm', '7cm', '8cm', '10cm'] as const;

export type PodSize = typeof POD_SIZES[number];

export const POD_SIZE_PRICES: Record<PodSize, string> = {
  '4cm': '29.99',
  '5cm': '49.99',
  '6cm': '69.99',
  '7cm': '99.99',
  '8cm': '129.99',
  '10cm': '169.99',
};

export type PriceMode = 'pod-default' | 'custom';

export interface CustomSizeRow {
  id: string;
  size: string;
  /** Optional middle segment in xxx-REG-xxx-size */
  code: string;
  price: string;
}

export function createCustomSizeRow(price = '0.00', code = ''): CustomSizeRow {
  return {
    id: Math.random().toString(36).slice(2, 11),
    size: '',
    code,
    price,
  };
}

export function getProductAbbreviation(title: string, handle?: string): string {
  const pad = (s: string) => (s.length >= 3 ? s.slice(0, 3) : s.padEnd(3, 'X').slice(0, 3));

  if (handle?.trim()) {
    const parts = handle.trim().toLowerCase().split('-').filter(Boolean);
    if (parts.length >= 3) {
      return pad(parts.slice(0, 3).map((p) => p[0]).join('').toUpperCase());
    }
    if (parts.length === 2) {
      return pad((parts[0].slice(0, 2) + (parts[1][0] || '')).toUpperCase());
    }
    const clean = parts[0]?.replace(/[^a-z]/gi, '') || '';
    if (clean.length >= 2) return pad(clean.toUpperCase());
  }

  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 3) {
    return pad(words.slice(0, 3).map((w) => w[0]).join('').toUpperCase());
  }
  if (words.length === 2) {
    return pad((words[0].slice(0, 2) + words[1][0]).toUpperCase());
  }

  const clean = title.replace(/[^a-zA-Z]/g, '');
  if (clean.length >= 2) return pad(clean.toUpperCase());

  return 'PRD';
}

/** POD SKU — always FIG-POD-{size} */
export function buildPodSku(size: string): string {
  const sz = size.trim();
  return sz ? `FIG-POD-${sz}` : 'FIG-POD';
}

export function buildPodVariants(_abbrev?: string, imageSrc = ''): Variant[] {
  return POD_SIZES.map((size, i) => ({
    id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
    option1Name: 'Size',
    option1Value: size,
    option2Name: '',
    option2Value: '',
    option3Name: '',
    option3Value: '',
    sku: buildPodSku(size),
    price: POD_SIZE_PRICES[size],
    compareAtPrice: '',
    imageSrc,
  }));
}

/**
 * 大货 SKU:
 * - {productCode}-REG-{size}
 * - {productCode}-REG-{subCode}-{size}
 */
export function buildBulkSku(productCode: string, size: string, subCode?: string): string {
  const pc = productCode.trim().toUpperCase();
  const sc = subCode?.trim().toUpperCase();
  const sz = size.trim();

  if (!pc) {
    if (!sz) return 'REG';
    return sc ? `REG-${sc}-${sz}` : `REG-${sz}`;
  }
  if (!sz) return sc ? `${pc}-REG-${sc}` : `${pc}-REG`;
  if (sc) return `${pc}-REG-${sc}-${sz}`;
  return `${pc}-REG-${sz}`;
}

export function parseBulkSku(sku: string): { productCode?: string; subCode?: string; size: string } {
  const regMatch = sku.match(/^([A-Z0-9]+)-REG-(?:([A-Z0-9]+)-)?(.+)$/i);
  if (regMatch) {
    return { productCode: regMatch[1].toUpperCase(), subCode: regMatch[2]?.toUpperCase(), size: regMatch[3] };
  }
  return { size: '' };
}

/** @deprecated Use buildBulkSku — legacy FIG-NOL alias */
export function buildNolSku(size: string, productCode?: string): string {
  return buildBulkSku(productCode || '', size);
}

/** @deprecated Use parseBulkSku */
export function parseNolSku(sku: string): { size: string; abbrev?: string } {
  const parsed = parseBulkSku(sku);
  return { size: parsed.size, abbrev: parsed.productCode };
}

export function buildBulkVariant(
  size: string,
  price: string,
  imageSrc = '',
  index = 0,
  productCode?: string,
  subCode?: string
): Variant {
  const sizeVal = size.trim() || 'Default';
  return {
    id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    option1Name: 'Size',
    option1Value: sizeVal,
    option2Name: '',
    option2Value: '',
    option3Name: '',
    option3Value: '',
    sku: buildBulkSku(productCode || '', size, subCode),
    price: price || '0.00',
    compareAtPrice: '',
    imageSrc,
  };
}

export function buildBulkVariantsFromRows(
  rows: CustomSizeRow[],
  productCode: string,
  imageSrc = ''
): Variant[] {
  const valid = rows.filter((r) => r.size.trim());
  return valid.map((row, i) =>
    buildBulkVariant(row.size, row.price, imageSrc, i, productCode, row.code.trim() || undefined)
  );
}

/** @deprecated Use buildBulkVariantsFromRows */
export function buildNolVariantsFromRows(rows: CustomSizeRow[], imageSrc = '', productCode = ''): Variant[] {
  return buildBulkVariantsFromRows(rows, productCode, imageSrc);
}

export function isPodVariantSet(variants: Variant[]): boolean {
  return variants.length > 0 && variants.every((v) => v.sku.startsWith('FIG-POD-') || v.sku === 'FIG-POD');
}

export function isBulkVariantSet(variants: Variant[]): boolean {
  return variants.length > 0 && variants.every((v) => /-REG-/.test(v.sku));
}

/** @deprecated Use isBulkVariantSet */
export function isNolVariantSet(variants: Variant[]): boolean {
  return isBulkVariantSet(variants);
}

export function applyPodAbbrevToVariants(variants: Variant[]): Variant[] {
  return variants.map((v) => {
    const size = v.option1Value;
    if ((POD_SIZES as readonly string[]).includes(size)) {
      return { ...v, sku: buildPodSku(size) };
    }
    return v;
  });
}

export function customSizeRowsFromVariants(variants: Variant[]): CustomSizeRow[] {
  if (variants.length === 0) return [createCustomSizeRow()];
  return variants.map((v) => {
    const parsed = parseBulkSku(v.sku);
    return {
      id: v.id,
      size: v.option1Value === 'Default' ? '' : v.option1Value,
      code: parsed.subCode || '',
      price: v.price,
    };
  });
}

export function applyBulkProductCodeToVariants(variants: Variant[], productCode?: string): Variant[] {
  const pc = productCode?.trim().toUpperCase() || '';
  return variants.map((v) => {
    const parsed = parseBulkSku(v.sku);
    const size = v.option1Value === 'Default' ? '' : v.option1Value;
    return { ...v, sku: buildBulkSku(pc, size, parsed.subCode) };
  });
}

/** @deprecated Use applyBulkProductCodeToVariants */
export function applyNolAbbrevToVariants(variants: Variant[], abbrev?: string): Variant[] {
  return applyBulkProductCodeToVariants(variants, abbrev);
}

export function priceModeFromSkuLine(line: 'pod' | 'bulk'): PriceMode {
  return line === 'pod' ? 'pod-default' : 'custom';
}

export function skuLineFromPriceMode(mode: PriceMode): 'pod' | 'bulk' {
  return mode === 'pod-default' ? 'pod' : 'bulk';
}
