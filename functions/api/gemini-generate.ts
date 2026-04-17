// Changes:
// - Cloudflare Pages Function version of the Gemini image-generation proxy.
//   Uses raw fetch against the Google Generative Language REST API instead
//   of the @google/genai SDK. Supports both Flash and Pro image models and
//   an optional reference image (passed via inlineData).
// - Body: {prompt, aspectRatio, model, referenceImage?}. Returns {image}.
import { jsonResponse, requireAuth, methodNotAllowed, Env } from './_utils/auth';

const FLASH_MODEL = 'gemini-2.5-flash-image';
const PRO_MODEL = 'gemini-3-pro-image-preview';

const ENDPOINT = (model: string, key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

type Body = {
  prompt?: string;
  aspectRatio?: string;
  model?: string;
  referenceImage?: string;
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const denied = requireAuth(request, env);
  if (denied) return denied;

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return jsonResponse(
      { error: 'Server misconfiguration: GEMINI_API_KEY is not set.' },
      500
    );
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const { prompt, aspectRatio, model, referenceImage } = body;
  if (typeof prompt !== 'string' || prompt.length === 0) {
    return jsonResponse({ error: 'Missing prompt.' }, 400);
  }
  if (typeof aspectRatio !== 'string') {
    return jsonResponse({ error: 'Missing aspectRatio.' }, 400);
  }
  if (model !== FLASH_MODEL && model !== PRO_MODEL) {
    return jsonResponse({ error: 'Invalid model.' }, 400);
  }

  const parts: any[] = [];
  if (referenceImage) {
    const matches = referenceImage.match(/^data:(.+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      parts.push({ inlineData: { mimeType: matches[1], data: matches[2] } });
    }
  }
  parts.push({ text: prompt });

  const imageConfig: any = { aspectRatio };
  if (model === PRO_MODEL) {
    imageConfig.imageSize = '1K';
  }

  const payload = {
    contents: [{ parts }],
    generationConfig: { imageConfig },
  };

  let upstream: Response;
  try {
    upstream = await fetch(ENDPOINT(model, apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    return jsonResponse(
      { error: `Upstream fetch failed: ${err?.message || String(err)}` },
      502
    );
  }

  const raw = await upstream.text();
  if (!upstream.ok) {
    return jsonResponse(
      { error: `Gemini upstream ${upstream.status}`, raw: raw.slice(0, 500) },
      502
    );
  }

  let g: any;
  try {
    g = JSON.parse(raw);
  } catch {
    return jsonResponse({ error: 'Upstream returned non-JSON.' }, 502);
  }

  const parts2 = g?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts2)) {
    for (const part of parts2) {
      if (part?.inlineData?.data) {
        const mimeType = part.inlineData.mimeType || 'image/png';
        return jsonResponse({
          image: `data:${mimeType};base64,${part.inlineData.data}`,
        });
      }
    }
  }

  return jsonResponse({ error: 'No image data in response.' }, 502);
};

export const onRequest: PagesFunction<Env> = async () => methodNotAllowed();
