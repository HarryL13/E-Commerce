// Changes: Reference max px follows 1K/2K selection for faster uploads at 1K.
import { compressDataUrl } from './imageUtils';
import { ImageSize, referenceMaxPxForImageSize } from './imageQuality';

export const API_REFERENCE_QUALITY = 0.92;

export async function prepareReferenceForApi(
  dataUrl: string | null | undefined,
  imageSize: ImageSize = '1K'
): Promise<string | undefined> {
  if (!dataUrl) return undefined;
  const maxPx = referenceMaxPxForImageSize(imageSize);
  return compressDataUrl(dataUrl, maxPx, maxPx, API_REFERENCE_QUALITY);
}
