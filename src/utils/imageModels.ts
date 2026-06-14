// Changes: Provider routing and OpenAI size mapping for multi-model image generation.
import { AspectRatio, ModelType } from '../types';

export type ImageProvider = 'gemini' | 'openai';

export const OPENAI_IMAGE_MODELS = new Set<string>([ModelType.GPT_IMAGE_2]);

export function getImageProvider(model: string): ImageProvider {
  if (OPENAI_IMAGE_MODELS.has(model) || model.startsWith('gpt-image')) {
    return 'openai';
  }
  return 'gemini';
}

export function getImageGenerateEndpoint(model: string): string {
  return getImageProvider(model) === 'openai' ? '/api/openai-generate' : '/api/gemini-generate';
}

/** gpt-image-1 supports 1024², 1024×1536, 1536×1024 (no native 4K). */
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
