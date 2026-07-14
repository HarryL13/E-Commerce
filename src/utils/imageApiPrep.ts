// Changes: Higher-res reference uploads (1536px) for high-precision Gemini / proxy generation.
import { compressDataUrl } from './imageUtils';

/** Keep product detail for 2K generation — was 768 for speed. */
export const API_REFERENCE_MAX_PX = 1536;
export const API_REFERENCE_QUALITY = 0.92;

export async function prepareReferenceForApi(
  dataUrl: string | null | undefined
): Promise<string | undefined> {
  if (!dataUrl) return undefined;
  return compressDataUrl(dataUrl, API_REFERENCE_MAX_PX, API_REFERENCE_MAX_PX, API_REFERENCE_QUALITY);
}
