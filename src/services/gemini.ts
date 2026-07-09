// Changes: Pass skuLine (pod/bulk) so API applies correct product title format.
import { apiFetch } from './authClient';

export async function generateProductDetails(
  imageBase64: string | null,
  contextText: string,
  contextMode: 'series' | 'template',
  skuLine?: 'pod' | 'bulk'
) {
  return apiFetch('/api/anthropic', {
    imageBase64,
    contextText,
    contextMode,
    skuLine,
  });
}
