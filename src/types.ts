// Changes: Image Studio uses Gemini image models only.
export type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";

export enum ModelType {
  GEMINI_31_FLASH_IMAGE = 'gemini-3.1-flash-image-preview',
  GEMINI_3_PRO_IMAGE_PREVIEW = 'gemini-3-pro-image-preview',
}

/** Legacy model IDs still accepted by the generate API. */
export const LEGACY_IMAGE_MODELS = ['gemini-2.5-flash-image', 'gpt-image-2'] as const;

export const IMAGE_MODEL_OPTIONS: ModelType[] = [
  ModelType.GEMINI_31_FLASH_IMAGE,
  ModelType.GEMINI_3_PRO_IMAGE_PREVIEW,
];

export function getModelLabel(model: ModelType | string): string {
  return model;
}

export enum AppTab {
  BACKGROUND = 'background',
  MULTIVIEW = 'multiview',
  SCENE = 'scene',
  LOGO = 'logo'
}

export type LogoPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center';

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
  aspectRatio: AspectRatio;
  model: ModelType | string;
  tab?: AppTab;
}

export interface GenerationConfig {
  prompt: string;
  aspectRatio: AspectRatio;
  model: ModelType;
  referenceImage?: string;
}

// Window interface augmentation for AI Studio key selection
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
  }
}
