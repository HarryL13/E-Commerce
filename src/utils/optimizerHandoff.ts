// Changes: Image Studio → Product Optimizer handoff — pending images to attach to live Shopify product.
import { GeneratedImage } from '../types';
import { buildImageFilenameMap } from './imageNaming';

export type PendingStudioImage = {
  url: string;
  sourceImageId: string;
  fileName?: string;
};

export type OptimizerHandoff = {
  id: string;
  images: PendingStudioImage[];
};

export function createOptimizerHandoffFromImages(studioImages: GeneratedImage[]): OptimizerHandoff {
  const sourceImageIds = studioImages.map((img) => img.id);
  const draftHandle = `studio-${Date.now()}`;
  const nameMap = buildImageFilenameMap(draftHandle, sourceImageIds);

  return {
    id: crypto.randomUUID(),
    images: studioImages.map((img) => ({
      url: img.url,
      sourceImageId: img.id,
      fileName: nameMap[img.id],
    })),
  };
}

export function filenamesForProductHandle(
  handle: string,
  images: PendingStudioImage[]
): PendingStudioImage[] {
  const nameMap = buildImageFilenameMap(handle, images.map((i) => i.sourceImageId));
  return images.map((img) => ({
    ...img,
    fileName: nameMap[img.sourceImageId],
  }));
}
