// Changes: Provider routing; resolveGeminiImageModel for multi-view and Gemini-only flows.
import { AspectRatio, ModelType } from '../types';

export type ImageProvider = 'gemini' | 'openai';

export const OPENAI_IMAGE_MODELS = new Set<string>([ModelType.GPT_IMAGE_2]);

export const GEMINI_IMAGE_MODELS = new Set<string>([
  ModelType.GEMINI_31_FLASH_IMAGE,
  ModelType.GEMINI_3_PRO_IMAGE_PREVIEW,
  'gemini-2.5-flash-image-preview',
]);

export function getImageProvider(model: string): ImageProvider {
  if (OPENAI_IMAGE_MODELS.has(model) || model.startsWith('gpt-image')) {
    return 'openai';
  }
  return 'gemini';
}

export function getImageGenerateEndpoint(model: string): string {
  return getImageProvider(model) === 'openai' ? '/api/openai-generate' : '/api/gemini-generate';
}

/** Prefer Gemini image model; fall back to flash preview when GPT/non-Gemini selected. */
export function resolveGeminiImageModel(model: string): ModelType {
  if (GEMINI_IMAGE_MODELS.has(model)) {
    return model as ModelType;
  }
  return ModelType.GEMINI_31_FLASH_IMAGE;
}

export function mapAspectRatioToOpenAiSize(aspectRatio: AspectRatio): string {
  switch (aspectRatio) {
    case '3:4':
    case '9:16':
      return '1024x1536';
    case '4:3':
    case '16:9':
      return '1536x1024';
    default:
      return '1024x1024';
  }
}
