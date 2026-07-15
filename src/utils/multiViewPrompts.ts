// Changes: Stronger no-crop framing; Zoom keeps margins; discourage white-on-white washout.
import { SkuBaseVariant } from './skuBaseTemplates';

export type MultiViewAngle = 'front' | 'top' | 'side' | 'zoom';

export const MULTIVIEW_ANGLES: { key: MultiViewAngle; label: string; labelZh: string }[] = [
  { key: 'front', label: 'Front Full', labelZh: '正面全身' },
  { key: 'top', label: 'Top', labelZh: '俯视' },
  { key: 'side', label: 'Side', labelZh: '侧面' },
  { key: 'zoom', label: 'Zoom', labelZh: '细节' },
];

/** Always-on angles for Multi-View. */
export const MULTIVIEW_REQUIRED_ANGLES = MULTIVIEW_ANGLES.filter((a) => a.key !== 'zoom');

export const MULTIVIEW_ZOOM_PREF_KEY = 'ecs_multiview_include_zoom';

export function readMultiViewIncludeZoom(): boolean {
  try {
    return localStorage.getItem(MULTIVIEW_ZOOM_PREF_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeMultiViewIncludeZoom(include: boolean): void {
  try {
    localStorage.setItem(MULTIVIEW_ZOOM_PREF_KEY, include ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** Front / Top / Side (+ Zoom when opted in). */
export function getActiveMultiViewAngles(
  includeZoom: boolean
): typeof MULTIVIEW_ANGLES {
  return includeZoom ? MULTIVIEW_ANGLES : (MULTIVIEW_REQUIRED_ANGLES as typeof MULTIVIEW_ANGLES);
}

const PRODUCT_PRESERVE = `The reference image is the exact product to photograph. Preserve the product faithfully: same shape, colors, materials, textures, proportions, branding, logos, and fine details. Do not redesign, replace, or invent a different product. Only change the camera angle and framing as instructed.`;

/** Shared anti-crop + separation rules — incomplete / clipped subjects are invalid. */
const FRAMING_COMPLETE = `CRITICAL FRAMING: The entire subject must be fully inside the frame — never crop the top of the head, hair, hat, hands, base, feet, or extremities. Leave generous even margins (~8–12% of the canvas) on all four sides so the full silhouette is visible. Do not push the subject against any edge. Soft contact shadow under the product is OK; keep edges crisp and complete.`;

const ANGLE_INSTRUCTIONS: Record<MultiViewAngle, string> = {
  front: `Camera angle: straight-on front view at eye level, showing the complete full product from head to toe (or full height for the entire item). Full-body hero shot, product centered, symmetrical frontal presentation, clean studio product photography. ${FRAMING_COMPLETE}`,
  top: `Camera angle: straight top-down bird's-eye view (90° overhead plan view). Show the entire product from above, centered. ${FRAMING_COMPLETE}`,
  side: `Camera angle: true side profile at eye level (90° from the front). Show the full product silhouette from the side, centered. ${FRAMING_COMPLETE}`,
  zoom: `Camera angle: closer 3/4 detail portrait of the most distinctive region (face + upper torso, or key logo/texture region) — NOT an extreme macro that chops the subject in half. Keep the chosen region fully intact with no hard crop through faces, hairlines, or hands. Leave clear margins around the visible region. ${FRAMING_COMPLETE}`,
};

const QUALITY_SUFFIX_WHITE =
  'Professional e-commerce product photography, soft even studio lighting, ultra-sharp focus, high detail, crisp edges. Pure solid white background (#FFFFFF). If the product itself is white or light-colored, add a subtle cool grey rim light or faint edge contrast so product edges stay readable against the white backdrop — never let white clothing dissolve into the background. Product perfectly centered with generous even margins. High-resolution commercial catalog quality. No text overlays, watermarks, colored backdrop, gradients, or props unless already on the product.';

const QUALITY_SUFFIX_BLACK_CUTOUT =
  'Professional e-commerce product photography, soft even studio lighting, ultra-sharp focus, high detail, crisp edges. CRITICAL: render the complete product isolated on a pure solid white background (#FFFFFF) with clean sharp edges — no grey backdrop, no floor shadow, no gradient, no vignette. The white area must be completely uniform for background removal. Keep all product pixels opaque and complete (no missing limbs, head, or base). Product perfectly centered with generous margins. High-resolution commercial catalog quality. No text overlays or watermarks.';

function qualitySuffixForBase(skuBase?: SkuBaseVariant): string {
  return skuBase === 'black' ? QUALITY_SUFFIX_BLACK_CUTOUT : QUALITY_SUFFIX_WHITE;
}

/** Build a multi-view prompt for Gemini with reference image. */
export function buildMultiViewPrompt(
  angle: MultiViewAngle,
  userNotes?: string,
  skuBase?: SkuBaseVariant
): string {
  const notes = userNotes?.trim();
  let prompt = `${PRODUCT_PRESERVE}

${ANGLE_INSTRUCTIONS[angle]}

${qualitySuffixForBase(skuBase)}`;

  if (notes) {
    prompt += `\n\nAdditional context: ${notes}`;
  }
  return prompt;
}

/** Batch mode when no user description — minimal context from analyze step. */
export function buildMultiViewPromptWithProduct(
  angle: MultiViewAngle,
  productDescription: string,
  skuBase?: SkuBaseVariant
): string {
  const desc = productDescription.trim() || 'product';
  return buildMultiViewPrompt(angle, `Product type: ${desc}`, skuBase);
}
