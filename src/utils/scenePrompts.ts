// Changes: Centralized Scene Gen prompt templates for Image Studio — optimized for e-commerce product placement.

/** Core instruction sent with every reference-image scene request. */
export const SCENE_PRODUCT_PRESERVE = `The reference image is the exact product to feature. Preserve the product faithfully: same shape, colors, materials, textures, proportions, branding, and fine details. Do not redesign, replace, crop out, or distort the product. Only change the environment, lighting, and camera framing around it.`;

export const SCENE_QUALITY_SUFFIX =
  'Professional e-commerce product photography, natural lighting, sharp focus on the product, realistic shadows and reflections, shallow depth of field on background, commercial quality. No text, watermarks, logos, or borders unless already on the product.';

export type SceneSmartType = 'scene' | 'ugc' | 'interaction';

/** Custom scene from user text (PromptBar). */
export function buildSceneCustomPrompt(userScene: string, hasReference = true): string {
  const scene = userScene.trim();
  if (!hasReference) {
    return `Create an e-commerce product scene: ${scene}. ${SCENE_QUALITY_SUFFIX}`;
  }
  return `${SCENE_PRODUCT_PRESERVE}

Scene: ${scene}

${SCENE_QUALITY_SUFFIX}`;
}

/** Batch mode — same product preservation wrapper for each uploaded file. */
export function buildSceneBatchCustomPrompt(userScene: string): string {
  return buildSceneCustomPrompt(userScene, true);
}

/** Smart button templates when processing many files (reference image per item). */
export function getSceneSmartBatchTemplate(type: SceneSmartType): string {
  const base = SCENE_PRODUCT_PRESERVE;
  if (type === 'scene') {
    return `${base}

Scene: Product on a polished white marble surface in a modern minimal interior. Soft high-key studio lighting, clean negative space, luxury catalog aesthetic.

${SCENE_QUALITY_SUFFIX}`;
  }
  if (type === 'ugc') {
    return `${base}

Scene: Product on a wooden coffee table in a cozy living room. Warm afternoon sunlight through a window, authentic lived-in home atmosphere, lifestyle UGC feel.

${SCENE_QUALITY_SUFFIX}`;
  }
  return `${base}

Scene: Close-up of a hand naturally holding the product to show scale. Soft blurred home interior background, realistic skin tones, candid interaction shot.

${SCENE_QUALITY_SUFFIX}`;
}

/** Scene-only presets when a reference image carries product identity. */
const SCENE_PRESETS_WITH_REF: string[] = [
  'Place the product on a polished white marble coffee table in a sunlit modern living room. High-end commercial catalog shot, soft window light.',
  'Display the product on a minimalist wooden shelf with curated neutral home decor. Interior design editorial style, warm ambient lighting.',
  'Place the product on a clean vanity table with soft morning light. Elegant beauty/lifestyle product shot, bright and airy.',
  'Set the product on a textured linen fabric surface in a cozy bedroom. Intimate lifestyle mood, gentle natural light.',
  'Place the product on a white kitchen island with modern cabinetry. Clean culinary lifestyle context, crisp daylight.',
];

/** Fallback presets when no reference image — needs object description from analyze. */
function scenePresetsFromDescription(objectDescription: string): string[] {
  const p = objectDescription.trim() || 'product';
  return [
    `High-end commercial photography of the ${p} on a polished white marble coffee table in a sunlit modern living room.`,
    `Interior design style shot: the ${p} displayed on a wooden shelf with minimal home decor.`,
    `Elegant product shot of the ${p} on a clean vanity table with soft morning light.`,
    `The ${p} on a textured fabric surface in a cozy bedroom setting.`,
    `Professional shot of the ${p} on a clean kitchen island countertop with modern white cabinetry.`,
  ];
}

const UGC_POOL_WITH_REF: string[] = [
  'POV lifestyle photo: hand holding the product in a cozy living room, warm ambient light, authentic home vibe.',
  'Casual snap: product on a bedside table beside a lamp and book, soft evening light.',
  'Product on a home office desk next to a laptop and steaming coffee cup, productive morning mood.',
  'Candid photo on a rustic wooden entryway console table, natural daylight.',
  'UGC style: product resting on a soft textured throw blanket on a sofa, relaxed weekend atmosphere.',
  'Bright morning shot on a kitchen counter near a window, fresh daylight.',
  'Product on a window sill with raindrops on glass, moody overcast aesthetic.',
  'Summer vibe on an outdoor patio table with dappled sunlight and greenery.',
  'Product on a bathroom vanity shelf, clean spa-like atmosphere.',
  'Top-down view on a picnic blanket in grass, cheerful outdoor lifestyle.',
];

const UGC_POOL_FROM_DESC = (p: string): string[] => [
  `A realistic POV photo of a hand holding the ${p} inside a cozy living room, warm ambient light.`,
  `A casual lifestyle snap of the ${p} on a bedside table next to a lamp and a book.`,
  `The ${p} on a home office desk next to a laptop and a steaming coffee cup.`,
  `A candid photo of the ${p} on a rustic wooden entryway console table.`,
  `UGC style: the ${p} on a soft textured throw blanket on a sofa.`,
  `A bright morning shot of the ${p} on a kitchen counter near a window.`,
  `The ${p} on a window sill with raindrops on glass, moody aesthetic.`,
  `A summer vibe shot of the ${p} on an outdoor patio table with dappled sunlight.`,
  `The ${p} on a bathroom vanity shelf, clean spa-like atmosphere.`,
  `Top-down view of the ${p} on a picnic blanket in the grass.`,
];

const INTERACTION_POOL_WITH_REF: string[] = [
  'POV shot: hand holding the product in a modern living room, sofa and soft decor in background.',
  'Close-up: hand resting near the product on a desk in a quiet library, books in background.',
  'Hand holding the product in a bright shopping mall, commercial lighting and glass storefronts.',
  'Street style: hand holding the product with blurred city street and pavement behind.',
  'Casual use at a coffee shop table, warm social atmosphere in background.',
  'Hand holding the product against clear blue sky in a park, nature background.',
  'Professional setting: hand holding the product in a modern office with glass walls.',
  'Hand holding the product inside a car, dashboard visible, natural daylight.',
  'Hand holding the product in a study hall, quiet academic atmosphere.',
  'Hand holding the product in a grocery store aisle, shelves in background.',
];

const INTERACTION_POOL_FROM_DESC = (p: string): string[] => [
  `POV shot of a hand holding the ${p} in a modern home living room, sofa and soft decor in background.`,
  `Close-up: hand resting on the ${p} on a desk in a quiet library, books in background.`,
  `Hand holding the ${p} in a modern shopping mall, bright commercial lighting.`,
  `Street photography: hand holding the ${p} with blurred city street behind.`,
  `Casual shot of the ${p} at a coffee shop table, warm social atmosphere.`,
  `Hand holding the ${p} against clear blue sky in a park.`,
  `Professional setting: hand holding the ${p} in a modern office, glass walls.`,
  `Hand holding the ${p} inside a car, dashboard visible.`,
  `Hand holding the ${p} in a study hall, quiet academic atmosphere.`,
  `Hand holding the ${p} in a grocery store aisle.`,
];

function wrapWithReference(sceneLine: string): string {
  return `${SCENE_PRODUCT_PRESERVE}

Scene: ${sceneLine}

${SCENE_QUALITY_SUFFIX}`;
}

/** Build final prompts for Smart Scenes / Lifestyle / Interaction buttons. */
export function buildSceneSmartPrompts(
  type: SceneSmartType,
  hasReference: boolean,
  objectDescription = 'product',
  shuffleAndPick?: (items: string[], count: number) => string[]
): string[] {
  const pick = shuffleAndPick ?? ((items: string[], count: number) => items.slice(0, count));
  const desc = objectDescription.trim() || 'product';

  if (type === 'scene') {
    if (hasReference) {
      return SCENE_PRESETS_WITH_REF.map(wrapWithReference);
    }
    return scenePresetsFromDescription(desc).map((line) => `${line} ${SCENE_QUALITY_SUFFIX}`);
  }

  if (type === 'ugc') {
    const pool = hasReference ? UGC_POOL_WITH_REF : UGC_POOL_FROM_DESC(desc);
    return pick(pool, 5).map((line) =>
      hasReference ? wrapWithReference(line) : `${line} ${SCENE_QUALITY_SUFFIX}`
    );
  }

  const pool = hasReference ? INTERACTION_POOL_WITH_REF : INTERACTION_POOL_FROM_DESC(desc);
  return pick(pool, 5).map((line) =>
    hasReference ? wrapWithReference(line) : `${line} ${SCENE_QUALITY_SUFFIX}`
  );
}
