// Changes:
// - Removed direct @google/genai SDK usage from the browser. All Gemini
//   calls (analyze + generate) now go through our serverless proxies at
//   /api/gemini-analyze and /api/gemini-generate so the GEMINI_API_KEY
//   stays on the server.
// - `ensureApiKey` was tied to the old in-browser AI Studio "select key"
//   flow; it's no longer needed because the server holds the key. Kept as
//   a no-op stub so existing call sites don't have to change.
// - `generateImageFromGemini` supports preferProxy + productDescription for local Multi-View fallback.
import { AspectRatio, ModelType } from '../types';
import { getImageGenerateEndpoint } from '../utils/imageModels';
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
