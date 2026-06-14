// Changes: FIG-POD + FIG-NOL pricing; per-row optional 3-letter code on FIG-NOL custom sizes.
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

export function buildPodSku(size: string, abbrev?: string): string {
  const code = abbrev?.trim().toUpperCase().slice(0, 3);
  if (!code) return `FIG-POD-${size}`;
  return `FIG-POD-${size}-${code}`;
}

export function buildPodVariants(abbrev?: string, imageSrc = ''): Variant[] {
  return POD_SIZES.map((size, i) => ({
    id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
    option1Name: 'Size',
    option1Value: size,
    option2Name: '',
    option2Value: '',
    option3Name: '',
    option3Value: '',
    sku: buildPodSku(size, abbrev),
    price: POD_SIZE_PRICES[size],
    compareAtPrice: '',
    imageSrc,
  }));
}

export function buildNolSku(size: string, abbrev?: string): string {
  const trimmed = size.trim();
  const code = abbrev?.trim().toUpperCase().slice(0, 3);
  if (!trimmed) {
    return code ? `FIG-NOL-${code}` : 'FIG-NOL';
  }
  return code ? `FIG-NOL-${trimmed}-${code}` : `FIG-NOL-${trimmed}`;
}

export function parseNolSku(sku: string): { size: string; abbrev?: string } {
  if (!sku.startsWith('FIG-NOL')) return { size: '' };
  const rest = sku.slice('FIG-NOL-'.length);
  const match = rest.match(/^(.+)-([A-Z]{3})$/);
  if (match) return { size: match[1], abbrev: match[2] };
  return { size: rest };
}

export function buildNolVariant(
  size: string,
  price: string,
  imageSrc = '',
  index = 0,
  abbrev?: string
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
    sku: buildNolSku(size, abbrev),
    price: price || '0.00',
    compareAtPrice: '',
    imageSrc,
  };
}

export function buildNolVariantsFromRows(rows: CustomSizeRow[], imageSrc = ''): Variant[] {
  const valid = rows.filter((r) => r.size.trim());
  return valid.map((row, i) =>
    buildNolVariant(row.size, row.price, imageSrc, i, row.code.trim() || undefined)
  );
}

export function isPodVariantSet(variants: Variant[]): boolean {
  return variants.length > 0 && variants.every((v) => v.sku.startsWith('FIG-POD-'));
}

export function isNolVariantSet(variants: Variant[]): boolean {
  return variants.length > 0 && variants.every((v) => v.sku.startsWith('FIG-NOL'));
}

export function applyPodAbbrevToVariants(variants: Variant[], abbrev?: string): Variant[] {
  return variants.map((v) => {
    const size = v.option1Value;
    if ((POD_SIZES as readonly string[]).includes(size)) {
      return { ...v, sku: buildPodSku(size, abbrev) };
    }
    return v;
  });
}

export function customSizeRowsFromVariants(variants: Variant[]): CustomSizeRow[] {
  if (variants.length === 0) return [createCustomSizeRow()];
  return variants.map((v) => {
    const parsed = parseNolSku(v.sku);
    return {
      id: v.id,
      size: v.option1Value === 'Default' ? '' : v.option1Value,
      code: parsed.abbrev || '',
      price: v.price,
    };
  });
}

export function applyNolAbbrevToVariants(variants: Variant[], abbrev?: string): Variant[] {
  return variants.map((v) => ({
    ...v,
    sku: buildNolSku(v.option1Value === 'Default' ? '' : v.option1Value, abbrev),
  }));
}
