export type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";

export enum ModelType {
  FLASH = 'gemini-2.5-flash-image',
  PRO = 'gemini-3-pro-image-preview'
}

export enum AppTab {
  BACKGROUND = 'background',
  MULTIVIEW = 'multiview',
  SCENE = 'scene'
}

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
  aspectRatio: AspectRatio;
  model: ModelType;
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
