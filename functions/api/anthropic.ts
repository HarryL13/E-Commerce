// Changes: SKU copy via proxy qwen3-vl-flash (with image) / qwen3.6-flash (text-only).
import { jsonResponse, requireAuth, methodNotAllowed, Env } from './_utils/auth';
import {
  getProxyTextModel,
  getProxyVisionModel,
  proxyChatCompletion,
  resolveProxyConfig,
} from './_utils/upstream';

type Body = {
  imageBase64?: string | null;
  contextText?: string;
  contextMode?: 'series' | 'template';
};

const DIRECT_MODEL = 'gemini-2.5-flash';

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

function parseModelJson(textBlock: string) {
  const cleaned = textBlock
    .replace(/^```(?:json)?\n?/, '')
    .replace(/\n?```$/, '')
    .trim();
  return JSON.parse(cleaned);
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const denied = requireAuth(request, env);
  if (denied) return denied;

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
  const proxy = resolveProxyConfig(env);

  try {
    if (proxy.useProxy) {
      const proxyModel = imageBase64 ? getProxyVisionModel(env) : getProxyTextModel(env);
      const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
      if (imageBase64) {
        content.push({ type: 'image_url', image_url: { url: imageBase64 } });
      }
      content.push({ type: 'text', text: prompt });

      try {
        const textBlock = await proxyChatCompletion(env, proxyModel, content, {
          maxTokens: 4096,
          temperature: 0.7,
        });
        return jsonResponse(parseModelJson(textBlock));
      } catch (err: any) {
        return jsonResponse(
          { error: err?.message || 'Proxy request failed.' },
          502
        );
      }
    }

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return jsonResponse(
        { error: 'Server misconfiguration: GEMINI_API_KEY is not set.' },
        500
      );
    }

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

    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${DIRECT_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
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
      }
    );

    const rawText = await upstream.text();
    if (!upstream.ok) {
      return jsonResponse(
        { error: `Gemini upstream ${upstream.status}: ${rawText.slice(0, 500)}` },
        502
      );
    }

    const geminiJson = JSON.parse(rawText);
    const textBlock: string | undefined = geminiJson?.candidates?.[0]?.content?.parts?.find(
      (p: any) => typeof p?.text === 'string'
    )?.text;

    if (!textBlock) {
      return jsonResponse(
        { error: 'No text content from model.', raw: JSON.stringify(geminiJson).slice(0, 500) },
        502
      );
    }

    try {
      return jsonResponse(parseModelJson(textBlock));
    } catch {
      return jsonResponse(
        { error: 'Model returned invalid JSON.', raw: textBlock.slice(0, 500) },
        502
      );
    }
  } catch (err: any) {
    return jsonResponse(
      { error: `Upstream fetch failed: ${err?.message || String(err)}` },
      502
    );
  }
};

export const onRequest: PagesFunction<Env> = async () => methodNotAllowed();
