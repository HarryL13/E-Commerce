// Changes: Auto-retry failed image gens (default 3 attempts) with preferProxy on retries.
import { AspectRatio, ModelType } from '../types';
import { getImageGenerateEndpoint } from '../utils/imageModels';
import { ImageSize, DEFAULT_IMAGE_SIZE } from '../utils/imageQuality';
import { IMAGE_GEN_RETRIES, withRetry } from '../utils/runPool';
import { apiFetch } from './authClient';

// Kept as a no-op for back-compat with existing UI call sites.
export const ensureApiKey = async (_model: ModelType): Promise<boolean> => {
  return true;
};

export const analyzeImage = async (base64Image: string): Promise<string> => {
  try {
    const data = await apiFetch<{ text: string }>('/api/gemini-analyze', {
      base64Image,
    });
    return data.text || 'object';
  } catch (e) {
    console.error('analyzeImage failed', e);
    return 'object';
  }
};

export type ImageGenOptions = {
  productDescription?: string;
  preferProxy?: boolean;
  imageSize?: ImageSize;
  onMode?: (mode: string) => void;
  /** Extra retries beyond the first try (default IMAGE_GEN_RETRIES = 2 → 3 total). */
  retries?: number;
  /** Called before a retry (attempt is 2..maxAttempts). */
  onRetry?: (attempt: number, maxAttempts: number, errorMessage: string) => void;
};

async function generateOnce(
  prompt: string,
  aspectRatio: AspectRatio,
  model: ModelType,
  referenceImage: string | undefined,
  referenceImages: string[] | undefined,
  options: ImageGenOptions | undefined,
  preferProxy: boolean | undefined
): Promise<string> {
  const payload: Record<string, unknown> = {
    prompt,
    aspectRatio,
    model,
    imageSize: options?.imageSize ?? DEFAULT_IMAGE_SIZE,
  };

  if (referenceImages && referenceImages.length > 0) {
    payload.referenceImages = referenceImages;
  } else if (referenceImage) {
    payload.referenceImage = referenceImage;
  }

  if (options?.productDescription) {
    payload.productDescription = options.productDescription;
  }
  if (preferProxy) {
    payload.preferProxy = true;
  }

  const endpoint = getImageGenerateEndpoint(model);
  const data = await apiFetch<{ image: string; mode?: string }>(endpoint, payload);
  if (!data.image) throw new Error('No image returned from server.');
  if (data.mode) options?.onMode?.(data.mode);
  return data.image;
}

/** Generate an image; on failure automatically regenerates (proxy fallback on retries). */
export const generateImageFromGemini = async (
  prompt: string,
  aspectRatio: AspectRatio,
  model: ModelType,
  referenceImage?: string,
  referenceImages?: string[],
  options?: ImageGenOptions
): Promise<string> => {
  const retries = options?.retries ?? IMAGE_GEN_RETRIES;
  let attemptIndex = 0;

  return withRetry(
    async () => {
      attemptIndex += 1;
      // First try honors caller preferProxy; later attempts force proxy for reliability.
      const preferProxy = attemptIndex === 1 ? options?.preferProxy : true;
      return generateOnce(
        prompt,
        aspectRatio,
        model,
        referenceImage,
        referenceImages,
        options,
        preferProxy
      );
    },
    {
      retries,
      delayMs: 1600,
      onRetry: (attempt, maxAttempts, err) => {
        const message = err instanceof Error ? err.message : String(err ?? 'unknown');
        console.warn(`Image gen retry ${attempt}/${maxAttempts}:`, message);
        options?.onRetry?.(attempt, maxAttempts, message);
      },
    }
  );
};
