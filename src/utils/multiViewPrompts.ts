// Changes: Multi-View prompts — preserve product; pure white backdrop for SKU base compositing.

export type MultiViewAngle = 'top' | 'side' | 'zoom';

export const MULTIVIEW_ANGLES: { key: MultiViewAngle; label: string }[] = [
  { key: 'top', label: 'Top' },
  { key: 'side', label: 'Side' },
  { key: 'zoom', label: 'Zoom' },
];

const PRODUCT_PRESERVE = `The reference image is the exact product to photograph. Preserve the product faithfully: same shape, colors, materials, textures, proportions, branding, logos, and fine details. Do not redesign, replace, or invent a different product. Only change the camera angle and framing as instructed.`;

const ANGLE_INSTRUCTIONS: Record<MultiViewAngle, string> = {
  top: `Camera angle: straight top-down bird's-eye view (90° overhead plan view). Show the entire product from above, centered on a clean neutral studio backdrop.`,
  side: `Camera angle: true side profile at eye level (90° from the front). Show the full product silhouette from the side, centered on a clean neutral studio backdrop.`,
  zoom: `Camera angle: tight macro close-up on the most distinctive detail of the same product (texture, logo, or key feature). Shallow depth of field, product fills most of the frame.`,
};

const QUALITY_SUFFIX =
  'Professional e-commerce product photography, soft even studio lighting, sharp focus. Pure solid white background (#FFFFFF), product perfectly centered in frame with generous even margins. No text overlays, watermarks, colored backdrop, gradients, or props unless already on the product.';

/** Build a multi-view prompt for Gemini with reference image. */
export function buildMultiViewPrompt(angle: MultiViewAngle, userNotes?: string): string {
  const notes = userNotes?.trim();
  let prompt = `${PRODUCT_PRESERVE}

${ANGLE_INSTRUCTIONS[angle]}

${QUALITY_SUFFIX}`;

  if (notes) {
    prompt += `\n\nAdditional context: ${notes}`;
  }
  return prompt;
}

/** Batch mode when no user description — minimal context from analyze step. */
export function buildMultiViewPromptWithProduct(
  angle: MultiViewAngle,
  productDescription: string
): string {
  const desc = productDescription.trim() || 'product';
  return buildMultiViewPrompt(angle, `Product type: ${desc}`);
}
