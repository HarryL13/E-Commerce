// Changes: Canvas logo overlay by position — no AI; strips black logo backgrounds.
import { LogoPosition } from '../types';

const POSITION_LABELS: Record<LogoPosition, string> = {
  'top-left': 'Top Left',
  'top-right': 'Top Right',
  'bottom-left': 'Bottom Left',
  'bottom-right': 'Bottom Right',
  'center': 'Center',
};

export function getLogoPositionLabel(position: LogoPosition): string {
  return POSITION_LABELS[position];
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

function luminance(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Make near-black (or near-white) studio backdrops transparent on logo PNGs
 * so orange-on-black marks like JuJuBit sit cleanly on the product.
 */
async function logoWithTransparentBackdrop(logoSrc: string): Promise<HTMLImageElement> {
  const source = await loadImage(logoSrc);
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas not supported');

  ctx.drawImage(source, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Sample corner majority: black vs white backdrop
  const corners = [
    [2, 2],
    [canvas.width - 3, 2],
    [2, canvas.height - 3],
    [canvas.width - 3, canvas.height - 3],
  ] as const;
  let cornerLum = 0;
  for (const [x, y] of corners) {
    const i = (y * canvas.width + x) * 4;
    cornerLum += luminance(data[i], data[i + 1], data[i + 2]);
  }
  cornerLum /= corners.length;
  const stripBlack = cornerLum < 80;
  const stripWhite = cornerLum > 200;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = luminance(r, g, b);
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);

    if (stripBlack && lum < 40 && chroma < 24) {
      data[i + 3] = 0;
    } else if (stripWhite && lum > 245 && chroma < 18) {
      data[i + 3] = 0;
    }
  }

  // Trim transparent margins so size% maps to visible logo, not padded canvas
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (data[(y * canvas.width + x) * 4 + 3] > 8) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX <= minX || maxY <= minY) {
    ctx.putImageData(imageData, 0, 0);
    return loadImage(canvas.toDataURL('image/png'));
  }

  const pad = 2;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(canvas.width - 1, maxX + pad);
  maxY = Math.min(canvas.height - 1, maxY + pad);
  const tw = maxX - minX + 1;
  const th = maxY - minY + 1;

  ctx.putImageData(imageData, 0, 0);

  const out = document.createElement('canvas');
  out.width = tw;
  out.height = th;
  const outCtx = out.getContext('2d');
  if (!outCtx) throw new Error('Canvas not supported');
  outCtx.drawImage(canvas, minX, minY, tw, th, 0, 0, tw, th);

  return loadImage(out.toDataURL('image/png'));
}

function logoDrawRect(
  position: LogoPosition,
  canvasW: number,
  canvasH: number,
  logoW: number,
  logoH: number,
  sizePercent: number
): { x: number; y: number; w: number; h: number } {
  const margin = Math.round(Math.min(canvasW, canvasH) * 0.04);
  const w = Math.max(8, Math.round(canvasW * (sizePercent / 100)));
  const h = Math.round(w * (logoH / logoW));

  let x = margin;
  let y = margin;

  switch (position) {
    case 'top-left':
      x = margin;
      y = margin;
      break;
    case 'top-right':
      x = canvasW - margin - w;
      y = margin;
      break;
    case 'bottom-left':
      x = margin;
      y = canvasH - margin - h;
      break;
    case 'bottom-right':
      x = canvasW - margin - w;
      y = canvasH - margin - h;
      break;
    case 'center':
      x = Math.round((canvasW - w) / 2);
      y = Math.round((canvasH - h) / 2);
      break;
  }

  return { x, y, w, h };
}

/** Place logo PNG onto product image by corner/center — pure canvas, no AI. */
export async function compositeLogoOnProduct(
  productDataUrl: string,
  logoDataUrl: string,
  position: LogoPosition,
  sizePercent: number
): Promise<string> {
  const [product, logo] = await Promise.all([
    loadImage(productDataUrl),
    logoWithTransparentBackdrop(logoDataUrl),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = product.width;
  canvas.height = product.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(product, 0, 0);

  const rect = logoDrawRect(
    position,
    canvas.width,
    canvas.height,
    logo.width,
    logo.height,
    sizePercent
  );
  ctx.drawImage(logo, rect.x, rect.y, rect.w, rect.h);

  return canvas.toDataURL('image/png');
}
