// Changes: Image analysis via direct Google Gemini API (GEMINI_DIRECT_API_KEY).
import { jsonResponse, requireAuth, methodNotAllowed, Env } from './_utils/auth';
import {
  DEFAULT_GEMINI_TEXT_MODEL,
  geminiGenerateText,
  imageBase64ToPart,
  requireDirectGeminiApiKey,
} from './_utils/geminiDirect';

const ANALYZE_PROMPT =
  'Identify the main product in this image for e-commerce photography. Output ONLY a short descriptor: product name plus key visual traits (material, color, finish, style). Examples: "matte black ceramic vase", "pink vinyl action figure", "brushed silver watch". No full sentences.';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const denied = requireAuth(request, env);
  if (denied) return denied;

  let body: { base64Image?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const base64Image = body?.base64Image;
  if (typeof base64Image !== 'string') {
    return jsonResponse({ error: 'Missing base64Image.' }, 400);
  }

  const imagePart = imageBase64ToPart(base64Image);
  if (!imagePart) {
    return jsonResponse({ error: 'Invalid image format.' }, 400);
  }

  try {
    const apiKey = requireDirectGeminiApiKey(env);
    const text = await geminiGenerateText(
      apiKey,
      DEFAULT_GEMINI_TEXT_MODEL,
      [imagePart, { text: ANALYZE_PROMPT }],
      { maxOutputTokens: 128, temperature: 0.2 }
    );
    return jsonResponse({ text: text || 'object' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 502);
  }
};

export const onRequest: PagesFunction<Env> = async () => methodNotAllowed();
