// Changes: Logo placement prompt builder for Image Studio Logo Brand tab.
import { LogoPosition } from '../types';

const POSITION_DESCRIPTIONS: Record<LogoPosition, string> = {
  'top-left': 'upper-left corner, with comfortable padding from the top and left edges',
  'top-right': 'upper-right corner, with comfortable padding from the top and right edges',
  'bottom-left': 'lower-left corner, with comfortable padding from the bottom and left edges',
  'bottom-right': 'lower-right corner, with comfortable padding from the bottom and right edges',
  'center': 'exact center of the image',
};

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

export function buildLogoPlacementPrompt(
  position: LogoPosition,
  sizePercent: number,
  optionalPrompt?: string
): string {
  const positionDesc = POSITION_DESCRIPTIONS[position];
  const sizeDesc = `${sizePercent}% of the image width`;

  let prompt = `Composite a brand logo onto a product image for e-commerce.

The FIRST image is the product/base image. Preserve the product as the main subject — do not crop, replace, or distort it.
The SECOND image is the brand logo. Place this logo on the product image.

Logo placement: ${positionDesc}.
Logo size: approximately ${sizeDesc}. Keep the logo's original proportions (no stretching or squashing).
The logo must be crisp, high-resolution, readable, and professionally integrated with subtle contrast so it stands out on the product image.
Ultra-sharp commercial catalog quality. Do not add watermarks, extra text, or borders unless requested.`;

  const trimmed = optionalPrompt?.trim();
  if (trimmed) {
    prompt += `\n\nAdditional instructions: ${trimmed}`;
  }

  return prompt;
}
