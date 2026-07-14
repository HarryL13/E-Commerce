// Changes: 1K / 2K image precision preference — replaces model selector in Image Studio.
export type ImageSize = '1K' | '2K';

export const IMAGE_SIZE_OPTIONS: { value: ImageSize; label: string; hint: string }[] = [
  { value: '1K', label: '1K', hint: '更快' },
  { value: '2K', label: '2K', hint: '更高清' },
];

export const IMAGE_SIZE_PREF_KEY = 'ecs_image_size';
export const DEFAULT_IMAGE_SIZE: ImageSize = '1K';

export function isImageSize(value: string): value is ImageSize {
  return value === '1K' || value === '2K';
}

export function readImageSizePreference(): ImageSize {
  try {
    const saved = localStorage.getItem(IMAGE_SIZE_PREF_KEY);
    return saved && isImageSize(saved) ? saved : DEFAULT_IMAGE_SIZE;
  } catch {
    return DEFAULT_IMAGE_SIZE;
  }
}

export function writeImageSizePreference(size: ImageSize): void {
  try {
    localStorage.setItem(IMAGE_SIZE_PREF_KEY, size);
  } catch {
    /* ignore */
  }
}

/** Approximate square export size for Multi-View compositing. */
export function compositePxForImageSize(size: ImageSize): number {
  return size === '2K' ? 2048 : 1024;
}

export function referenceMaxPxForImageSize(size: ImageSize): number {
  return size === '2K' ? 1536 : 1024;
}
