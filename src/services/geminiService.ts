// Changes: Image gen options include imageSize (1K/2K); model still routed via endpoint helper.
import { AspectRatio, ModelType } from '../types';
import { getImageGenerateEndpoint } from '../utils/imageModels';
import { ImageSize, DEFAULT_IMAGE_SIZE } from '../utils/imageQuality';
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
};

export const generateImageFromGemini = async (
  prompt: string,
  aspectRatio: AspectRatio,
  model: ModelType,
  referenceImage?: string,
  referenceImages?: string[],
  options?: ImageGenOptions
): Promise<string> => {
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
  if (options?.preferProxy) {
    payload.preferProxy = true;
  }

  const endpoint = getImageGenerateEndpoint(model);
  const data = await apiFetch<{ image: string; mode?: string }>(endpoint, payload);
  if (!data.image) throw new Error('No image returned from server.');
  if (data.mode) options?.onMode?.(data.mode);
  return data.image;
};
