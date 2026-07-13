// Changes: Composite Multi-View product shots onto standardized SKU base templates (centered).

import { SKU_BASE_TEMPLATES, SkuBaseVariant } from './skuBaseTemplates';

/** Fraction of canvas used for the centered product slot (logo stays in corner). */
const PRODUCT_SLOT_RATIO = 0.72;

/** Pixels within this color distance from detected studio background become transparent. */
const BG_COLOR_TOLERANCE = 42;

const imageCache = new Map<string, Promise<HTMLImageElement>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return cached;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });

  imageCache.set(src, promise);
  return promise;
}

function sampleBackgroundColor(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const points = [
    [2, 2],
    [w - 3, 2],
    [2, h - 3],
    [w - 3, h - 3],
    [Math.floor(w / 2), 2],
    [Math.floor(w / 2), h - 3],
  ] as const;

  let r = 0;
  let g = 0;
  let b = 0;

  for (const [x, y] of points) {
    const [pr, pg, pb] = ctx.getImageData(x, y, 1, 1).data;
    r += pr;
    g += pg;
    b += pb;
  }

  const n = points.length;
  return { r: r / n, g: g / n, b: b / n };
}

function colorDistance(
  r: number,
  g: number,
  b: number,
  br: number,
  bg: number,
  bb: number
) {
  return Math.sqrt((r - br) ** 2 + (g - bg) ** 2 + (b - bb) ** 2);
}

/** Remove studio backdrop so the product can sit on the SKU base. */
async function stripStudioBackground(dataUrl: string): Promise<HTMLImageElement> {
  const source = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas not supported');

  ctx.drawImage(source, 0, 0);
  const { width: w, height: h } = canvas;
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const bg = sampleBackgroundColor(ctx, w, h);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const dist = colorDistance(r, g, b, bg.r, bg.g, bg.b);
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

    if (dist < BG_COLOR_TOLERANCE || luminance > 238) {
      const alpha = dist < BG_COLOR_TOLERANCE * 0.55 ? 0 : Math.min(1, (dist - BG_COLOR_TOLERANCE * 0.55) / 18);
      data[i + 3] = Math.round(data[i + 3] * (1 - alpha));
    }
  }

  ctx.putImageData(imageData, 0, 0);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to build cutout'));
    img.src = canvas.toDataURL('image/png');
  });
}

function fitCenterRect(
  srcW: number,
  srcH: number,
  slotW: number,
  slotH: number
): { drawW: number; drawH: number; x: number; y: number } {
  const scale = Math.min(slotW / srcW, slotH / srcH);
  const drawW = Math.round(srcW * scale);
  const drawH = Math.round(srcH * scale);
  const x = Math.round((slotW - drawW) / 2);
  const y = Math.round((slotH - drawH) / 2);
  return { drawW, drawH, x, y };
}

/**
 * Place a generated Multi-View image on the standardized SKU base with the product centered.
 */
export async function compositeMultiViewOnSkuBase(
  generatedDataUrl: string,
  variant: SkuBaseVariant
): Promise<string> {
  const templateUrl = SKU_BASE_TEMPLATES[variant].url;
  const [template, product] = await Promise.all([
    loadImage(templateUrl),
    stripStudioBackground(generatedDataUrl),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = template.width;
  canvas.height = template.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.drawImage(template, 0, 0);

  const slotSize = Math.round(Math.min(canvas.width, canvas.height) * PRODUCT_SLOT_RATIO);
  const slotX = Math.round((canvas.width - slotSize) / 2);
  const slotY = Math.round((canvas.height - slotSize) / 2);

  const { drawW, drawH, x, y } = fitCenterRect(
    product.width,
    product.height,
    slotSize,
    slotSize
  );

  ctx.drawImage(product, slotX + x, slotY + y, drawW, drawH);

  return canvas.toDataURL('image/png');
}
