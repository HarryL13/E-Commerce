// Changes:
// - Removed direct @google/genai SDK usage from the browser. All Gemini
//   calls (analyze + generate) now go through our serverless proxies at
//   /api/gemini-analyze and /api/gemini-generate so the GEMINI_API_KEY
//   stays on the server.
// - `ensureApiKey` was tied to the old in-browser AI Studio "select key"
//   flow; it's no longer needed because the server holds the key. Kept as
//   a no-op stub so existing call sites don't have to change.
import { AspectRatio, ModelType } from '../types';
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

export const generateImageFromGemini = async (
  prompt: string,
  aspectRatio: AspectRatio,
  model: ModelType,
  referenceImage?: string
): Promise<string> => {
  const data = await apiFetch<{ image: string }>('/api/gemini-generate', {
    prompt,
    aspectRatio,
    model,
    referenceImage,
  });
  if (!data.image) throw new Error('No image returned from server.');
  return data.image;
};
