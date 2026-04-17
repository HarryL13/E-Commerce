// Changes:
// - REWRITTEN to use Google Gemini instead of Anthropic Claude, because the
//   company LiteLLM proxy is a bare-IP URL which Cloudflare Workers runtime
//   blocks with "error 1003: Direct IP access not allowed". Gemini is reached
//   via a proper HTTPS hostname (generativelanguage.googleapis.com) so it works
//   fine on Cloudflare Pages.
// - The endpoint path is kept as /api/anthropic so the existing front-end code
//   (src/services/gemini.ts) doesn't need to change.
// - Contract is unchanged: input {imageBase64?, contextText, contextMode},
//   output a parsed JSON with title / about_section / description_html / ...
// - Uses gemini-2.5-flash which is fast, cheap, and has a generous free tier.
import { jsonResponse, requireAuth, methodNotAllowed, Env } from './_utils/auth';

type Body = {
  imageBase64?: string | null;
  contextText?: string;
  contextMode?: 'series' | 'template';
};

const MODEL = 'gemini-2.5-flash';
const ENDPOINT = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;

function buildPrompt(contextMode: 'series' | 'template', contextText: string) {
  return `You are an expert Shopify product copywriter and SEO specialist.
Based on the provided image and the overall ${contextMode} information, generate comprehensive product listing details.

CRITICAL INSTRUCTION FOR TITLE & HANDLE:
Carefully analyze the specific visual details of the image.
The "title" MUST follow this exact format: "[Name of ${contextMode}] - [Creative Name]".
- The "[Name of ${contextMode}]" should be derived from the ${contextMode} information provided below.
- The "[Creative Name]" MUST be 1-3 words maximum, highly creative, and descriptive of this EXACT specific item's unique visual characteristics (colors, poses, vibe) so it stands out.
The "handle" must be a URL-friendly version of this unique title.

${contextMode.toUpperCase()} INFORMATION:
${contextText}

Generate product listing details as a JSON object with these exact fields:
- title (string)
- about_section (string): plain text of the About paragraph
- description_html (string): full HTML description, ALL content center-aligned inside <div style="text-align: center;">...</div>, structured as: 1) bold heading, 2) intro paragraph, 3) About section, 4) Specification section (NO Size or Color), 5) *Note disclaimer
- seo_title (string)
- seo_description (string)
- tags (array of strings)
- handle (string): URL-friendly slug
- vendor (string)
- category (string)
- type (string)

Do not include markdown code blocks. Return only the raw JSON object.`;
}

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

  const { imageBase64, contextText, contextMode } = body;
  if (contextMode !== 'series' && contextMode !== 'template') {
    return jsonResponse({ error: 'Invalid contextMode.' }, 400);
  }
  if (typeof contextText !== 'string') {
    return jsonResponse({ error: 'Missing contextText.' }, 400);
  }

  const prompt = buildPrompt(contextMode, contextText);

  const parts: any[] = [];
  if (imageBase64) {
    const commaIdx = imageBase64.indexOf(',');
    const header = imageBase64.slice(0, commaIdx);
    const data = imageBase64.slice(commaIdx + 1);
    const mimeMatch = header.match(/data:([^;]+);base64/);
    const mimeType = mimeMatch?.[1] || 'image/png';
    parts.push({ inlineData: { mimeType, data } });
  }
  parts.push({ text: prompt });

  let upstream: Response;
  try {
    upstream = await fetch(ENDPOINT(apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      }),
    });
  } catch (err: any) {
    return jsonResponse(
      { error: `Upstream fetch failed: ${err?.message || String(err)}` },
      502
    );
  }

  const rawText = await upstream.text();
  if (!upstream.ok) {
    return jsonResponse(
      { error: `Gemini upstream ${upstream.status}: ${rawText.slice(0, 500)}` },
      502
    );
  }

  let geminiJson: any;
  try {
    geminiJson = JSON.parse(rawText);
  } catch {
    return jsonResponse(
      { error: 'Upstream returned non-JSON response.', raw: rawText.slice(0, 500) },
      502
    );
  }

  const textBlock: string | undefined = geminiJson?.candidates?.[0]?.content?.parts?.find(
    (p: any) => typeof p?.text === 'string'
  )?.text;
  if (!textBlock) {
    return jsonResponse(
      { error: 'No text content from model.', raw: JSON.stringify(geminiJson).slice(0, 500) },
      502
    );
  }

  const cleaned = textBlock
    .replace(/^```(?:json)?\n?/, '')
    .replace(/\n?```$/, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    return jsonResponse(parsed);
  } catch {
    return jsonResponse(
      { error: 'Model returned invalid JSON.', raw: cleaned.slice(0, 500) },
      502
    );
  }
};

export const onRequest: PagesFunction<Env> = async () => methodNotAllowed();
