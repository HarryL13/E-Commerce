// Changes:
// - Removed direct Anthropic SDK usage from the browser. This now calls our
//   serverless proxy at /api/anthropic which holds the ANTHROPIC_API_KEY on
//   the server. Public API of generateProductDetails stays the same for the
//   UI (minus the apiKey arg, which is no longer needed in the browser).
// - Callers (SkuApp) must drop the apiKey argument when invoking this.
import { apiFetch } from './authClient';

export async function generateProductDetails(
  imageBase64: string | null,
  contextText: string,
  contextMode: 'series' | 'template'
) {
  return apiFetch('/api/anthropic', {
    imageBase64,
    contextText,
    contextMode,
  });
}
