// Changes: Image analysis via proxy qwen3-vl-flash (gemini-3-flash removed from gateway).
import { jsonResponse, requireAuth, methodNotAllowed, Env } from './_utils/auth';
import {
  getProxyVisionModel,
  proxyChatCompletion,
  resolveProxyConfig,
} from './_utils/upstream';

const DIRECT_MODEL = 'gemini-3-flash-preview';

const ANALYZE_PROMPT =
  'Identify the main product in this image for e-commerce photography. Output ONLY a short descriptor: product name plus key visual traits (material, color, finish, style). Examples: "matte black ceramic vase", "pink vinyl action figure", "brushed silver watch". No full sentences.';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const denied = requireAuth(request, env);
  if (denied) return denied;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const base64Image: string | undefined = body?.base64Image;
  if (typeof base64Image !== 'string') {
    return jsonResponse({ error: 'Missing base64Image.' }, 400);
  }

  const proxy = resolveProxyConfig(env);

  try {
    if (proxy.useProxy) {
      const text = await proxyChatCompletion(
        env,
        getProxyVisionModel(env),
        [
          { type: 'image_url', image_url: { url: base64Image } },
          { type: 'text', text: ANALYZE_PROMPT },
        ],
        { maxTokens: 128, temperature: 0.2 }
      );
      return jsonResponse({ text: text || 'object' });
    }

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return jsonResponse(
        { error: 'Server misconfiguration: GEMINI_API_KEY is not set.' },
        500
      );
    }

    const matches = base64Image.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
      return jsonResponse({ error: 'Invalid image format.' }, 400);
    }
    const [, mimeType, data] = matches;

    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${DIRECT_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inlineData: { mimeType, data } },
                { text: ANALYZE_PROMPT },
              ],
            },
          ],
        }),
      }
    );

    const raw = await upstream.text();
    if (!upstream.ok) {
      return jsonResponse(
        { error: `Gemini upstream ${upstream.status}`, raw: raw.slice(0, 500) },
        502
      );
    }

    const g = JSON.parse(raw);
    const text: string | undefined = g?.candidates?.[0]?.content?.parts?.find(
      (p: any) => typeof p?.text === 'string'
    )?.text;

    return jsonResponse({ text: text?.trim() || 'object' });
  } catch (err: any) {
    return jsonResponse(
      { error: err?.message || `Upstream fetch failed: ${String(err)}` },
      502
    );
  }
};

export const onRequest: PagesFunction<Env> = async () => methodNotAllowed();
