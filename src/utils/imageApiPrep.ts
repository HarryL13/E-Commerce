// Changes: Smaller reference uploads for faster Gemini / proxy image API calls.
import { compressDataUrl } from './imageUtils';

export const API_REFERENCE_MAX_PX = 768;
export const API_REFERENCE_QUALITY = 0.8;

export async function prepareReferenceForApi(
  dataUrl: string | null | undefined
): Promise<string | undefined> {
  if (!dataUrl) return undefined;
  return compressDataUrl(dataUrl, API_REFERENCE_MAX_PX, API_REFERENCE_MAX_PX, API_REFERENCE_QUALITY);
}
