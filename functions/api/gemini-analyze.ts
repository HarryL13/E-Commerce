// Changes:
// - Cloudflare Pages Function version of the Gemini image-analysis proxy.
//   Uses raw fetch against the Google Generative Language REST API instead
//   of the @google/genai SDK (which pulls in Node-only dependencies).
// - Body: {base64Image: "data:image/...;base64,..."}. Returns {text}.
import { jsonResponse, requireAuth, methodNotAllowed, Env } from './_utils/auth';

const MODEL = 'gemini-3-flash-preview';
const ENDPOINT = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;

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

  const matches = base64Image.match(/^data:(.+);base64,(.+)$/);
  if (!matches) {
    return jsonResponse({ error: 'Invalid image format.' }, 400);
  }
  const [, mimeType, data] = matches;

  let upstream: Response;
  try {
    upstream = await fetch(ENDPOINT(apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inlineData: { mimeType, data } },
              {
                text:
                  "Identify the main object in this image. Output ONLY the object name and key material/color adjectives (e.g. 'red leather handbag', 'ceramic coffee mug', 'action figure'). Do not write a sentence.",
              },
            ],
          },
        ],
      }),
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

  const text: string | undefined = g?.candidates?.[0]?.content?.parts?.find(
    (p: any) => typeof p?.text === 'string'
  )?.text;

  return jsonResponse({ text: text?.trim() || 'object' });
};

export const onRequest: PagesFunction<Env> = async () => methodNotAllowed();
