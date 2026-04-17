// Changes:
// - Cloudflare Pages Function version of the Anthropic proxy. Uses raw fetch
//   instead of the @anthropic-ai/sdk so it runs in the Workers runtime
//   (which doesn't support every Node API the SDK uses). This also makes
//   supporting LiteLLM-style custom BASE_URL + Bearer auth trivial.
// - Request body from client: {imageBase64?, contextText, contextMode}.
// - Env: either ANTHROPIC_API_KEY alone (official API), OR
//   ANTHROPIC_BASE_URL + ANTHROPIC_AUTH_TOKEN (LiteLLM-style proxy).
import { jsonResponse, requireAuth, methodNotAllowed, Env } from './_utils/auth';

type Body = {
  imageBase64?: string | null;
  contextText?: string;
  contextMode?: 'series' | 'template';
};

const OFFICIAL_BASE_URL = 'https://api.anthropic.com';
const MODEL = 'claude-sonnet-4-6';

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

  const baseURL = env.ANTHROPIC_BASE_URL?.replace(/\/+$/, '') || OFFICIAL_BASE_URL;
  const authToken = env.ANTHROPIC_AUTH_TOKEN;
  const apiKey = env.ANTHROPIC_API_KEY;

  if (baseURL === OFFICIAL_BASE_URL && !apiKey) {
    return jsonResponse(
      { error: 'Server misconfiguration: ANTHROPIC_API_KEY is not set.' },
      500
    );
  }
  if (baseURL !== OFFICIAL_BASE_URL && !(authToken || apiKey)) {
    return jsonResponse(
      {
        error:
          'Server misconfiguration: ANTHROPIC_BASE_URL is set but no ANTHROPIC_AUTH_TOKEN / ANTHROPIC_API_KEY to authenticate with.',
      },
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

  const content: any[] = [];
  if (imageBase64) {
    const commaIdx = imageBase64.indexOf(',');
    const header = imageBase64.slice(0, commaIdx);
    const base64Data = imageBase64.slice(commaIdx + 1);
    const mimeMatch = header.match(/data:([^;]+);base64/);
    const mimeType = mimeMatch?.[1] || 'image/png';
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: mimeType, data: base64Data },
    });
  }
  content.push({ type: 'text', text: prompt });

  // Pick auth mode. Custom base URL => Bearer; otherwise x-api-key.
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
  };
  if (baseURL === OFFICIAL_BASE_URL) {
    headers['x-api-key'] = apiKey!;
  } else {
    headers['Authorization'] = `Bearer ${authToken || apiKey}`;
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${baseURL}/v1/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        messages: [{ role: 'user', content }],
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
      { error: `Anthropic upstream ${upstream.status}: ${rawText}` },
      502
    );
  }

  let claudeJson: any;
  try {
    claudeJson = JSON.parse(rawText);
  } catch {
    return jsonResponse(
      { error: 'Upstream returned non-JSON response.', raw: rawText.slice(0, 500) },
      502
    );
  }

  // Find the text block in the response
  const textBlock = Array.isArray(claudeJson?.content)
    ? claudeJson.content.find((b: any) => b?.type === 'text')
    : null;
  const text: string | undefined = textBlock?.text;
  if (!text) {
    return jsonResponse({ error: 'No text content from model.' }, 502);
  }

  const cleaned = text
    .replace(/^```(?:json)?\n?/, '')
    .replace(/\n?```$/, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    return jsonResponse(parsed);
  } catch {
    return jsonResponse(
      { error: 'Model returned invalid JSON.', raw: cleaned },
      502
    );
  }
};

export const onRequest: PagesFunction<Env> = async () => methodNotAllowed();
