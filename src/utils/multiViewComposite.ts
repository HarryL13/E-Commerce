// Changes: Black-base compositing — flood-fill white matting so product is transparent on template.
import { SKU_BASE_TEMPLATES, SkuBaseVariant } from './skuBaseTemplates';
import {
  NEW_TAG_ASSETS,
  NewTagOverlayOptions,
  NewTagTextVariant,
  newTagVariantForSkuBase,
} from './newTagOverlay';

/** Fraction of canvas used for the centered product slot (logo stays in corner). */
const PRODUCT_SLOT_RATIO = 0.72;

/** Pixels within this color distance from detected studio background become transparent. */
const BG_COLOR_TOLERANCE = 42;

/** Margin from canvas edge for NEW badge (fraction of width). */
const NEW_TAG_MARGIN_RATIO = 0.04;

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
    [2, Math.floor(h / 2)],
    [w - 3, Math.floor(h / 2)],
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

function luminance(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function isBackgroundCandidate(
  r: number,
  g: number,
  b: number,
  bg: { r: number; g: number; b: number },
  forBlackBase: boolean
): boolean {
  const lum = luminance(r, g, b);
  const dist = colorDistance(r, g, b, bg.r, bg.g, bg.b);
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);

  if (forBlackBase) {
    return lum > 198 || dist < 58 || (lum > 175 && chroma < 28);
  }

  return dist < BG_COLOR_TOLERANCE || lum > 238;
}

/** Flood-fill studio backdrop from image edges — keeps product interior intact. */
function floodFillBackground(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  bg: { r: number; g: number; b: number },
  forBlackBase: boolean
) {
  const visited = new Uint8Array(w * h);
  const queue: number[] = [];

  const trySeed = (x: number, y: number) => {
    const idx = y * w + x;
    if (visited[idx]) return;
    const i = idx * 4;
    if (!isBackgroundCandidate(data[i], data[i + 1], data[i + 2], bg, forBlackBase)) return;
    visited[idx] = 1;
    queue.push(idx);
  };

  for (let x = 0; x < w; x++) {
    trySeed(x, 0);
    trySeed(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    trySeed(0, y);
    trySeed(w - 1, y);
  }

  while (queue.length > 0) {
    const idx = queue.pop()!;
    const x = idx % w;
    const y = (idx - x) / w;
    const i = idx * 4;
    data[i + 3] = 0;

    const neighbors = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ] as const;

    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const nIdx = ny * w + nx;
      if (visited[nIdx]) continue;
      const ni = nIdx * 4;
      if (!isBackgroundCandidate(data[ni], data[ni + 1], data[ni + 2], bg, forBlackBase)) continue;
      visited[nIdx] = 1;
      queue.push(nIdx);
    }
  }
}

/** Soften white fringing on cutout edges when compositing onto black. */
function despillWhiteFringe(data: Uint8ClampedArray, forBlackBase: boolean) {
  if (!forBlackBase) return;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha === 0 || alpha === 255) continue;

    const lum = luminance(data[i], data[i + 1], data[i + 2]);
    if (lum > 160) {
      const factor = 1 - alpha / 255;
      data[i] = Math.round(data[i] * (1 - factor * 0.35));
      data[i + 1] = Math.round(data[i + 1] * (1 - factor * 0.35));
      data[i + 2] = Math.round(data[i + 2] * (1 - factor * 0.35));
    }
  }
}

/** Trim fully transparent margins so the product scales by visible bounds, not full canvas. */
function trimTransparentBounds(
  data: Uint8ClampedArray,
  w: number,
  h: number
): { data: Uint8ClampedArray; w: number; h: number } {
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 8) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX <= minX || maxY <= minY) {
    return { data, w, h };
  }

  const pad = 2;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);

  const tw = maxX - minX + 1;
  const th = maxY - minY + 1;
  const trimmed = new Uint8ClampedArray(tw * th * 4);

  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const src = ((minY + y) * w + (minX + x)) * 4;
      const dst = (y * tw + x) * 4;
      trimmed[dst] = data[src];
      trimmed[dst + 1] = data[src + 1];
      trimmed[dst + 2] = data[src + 2];
      trimmed[dst + 3] = data[src + 3];
    }
  }

  return { data: trimmed, w: tw, h: th };
}

/** Remove studio backdrop so the product can sit on the SKU base. */
async function stripStudioBackground(
  dataUrl: string,
  variant: SkuBaseVariant
): Promise<HTMLImageElement> {
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
  const forBlackBase = variant === 'black';

  floodFillBackground(data, w, h, bg, forBlackBase);

  if (!forBlackBase) {
    for (let i = 0; i < data.length; i += 4) {
      const dist = colorDistance(data[i], data[i + 1], data[i + 2], bg.r, bg.g, bg.b);
      const lum = luminance(data[i], data[i + 1], data[i + 2]);
      if (dist < BG_COLOR_TOLERANCE || lum > 238) {
        const alpha =
          dist < BG_COLOR_TOLERANCE * 0.55 ? 0 : Math.min(1, (dist - BG_COLOR_TOLERANCE * 0.55) / 18);
        data[i + 3] = Math.round(data[i + 3] * (1 - alpha));
      }
    }
  }

  despillWhiteFringe(data, forBlackBase);

  const trimmed = forBlackBase ? trimTransparentBounds(data, w, h) : { data, w, h };

  const outCanvas = document.createElement('canvas');
  outCanvas.width = trimmed.w;
  outCanvas.height = trimmed.h;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) throw new Error('Canvas not supported');

  const outImage = new ImageData(trimmed.data, trimmed.w, trimmed.h);
  outCtx.putImageData(outImage, 0, 0);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to build cutout'));
    img.src = outCanvas.toDataURL('image/png');
  });
}

/** Strip near-black backdrop from NEW tag PNG so it overlays cleanly. */
async function loadNewTagWithTransparency(variant: NewTagTextVariant): Promise<HTMLImageElement> {
  const source = await loadImage(NEW_TAG_ASSETS[variant].url);
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas not supported');

  ctx.drawImage(source, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r < 28 && g < 28 && b < 28) {
      data[i + 3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load NEW tag'));
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

function drawNewTagBottomLeft(
  ctx: CanvasRenderingContext2D,
  badge: HTMLImageElement,
  canvasW: number,
  canvasH: number,
  scalePercent: number
) {
  const margin = Math.round(canvasW * NEW_TAG_MARGIN_RATIO);
  const drawW = Math.round(canvasW * (scalePercent / 100));
  const drawH = Math.round(drawW * (badge.height / badge.width));
  const x = margin;
  const y = canvasH - margin - drawH;
  ctx.drawImage(badge, x, y, drawW, drawH);
}

export type MultiViewCompositeOptions = {
  newTag?: NewTagOverlayOptions;
};

/**
 * Place a generated Multi-View image on the standardized SKU base with the product centered.
 * Black base: product is cut out (transparent) and composited directly on the template.
 */
export async function compositeMultiViewOnSkuBase(
  generatedDataUrl: string,
  variant: SkuBaseVariant,
  options: MultiViewCompositeOptions = {}
): Promise<string> {
  const templateUrl = SKU_BASE_TEMPLATES[variant].url;
  const [template, product] = await Promise.all([
    loadImage(templateUrl),
    stripStudioBackground(generatedDataUrl, variant),
  ]);

  const newTagOpts = options.newTag;
  const newTagVariant = newTagVariantForSkuBase(variant);
  const newTagImage =
    newTagOpts?.enabled
      ? await loadNewTagWithTransparency(newTagVariant)
      : null;

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

  if (newTagImage && newTagOpts) {
    drawNewTagBottomLeft(
      ctx,
      newTagImage,
      canvas.width,
      canvas.height,
      newTagOpts.scalePercent
    );
  }

  return canvas.toDataURL('image/png');
}
