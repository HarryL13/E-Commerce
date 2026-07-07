// Changes: SKU copy via direct Google Gemini API (GEMINI_DIRECT_API_KEY).
import { jsonResponse, requireAuth, methodNotAllowed, Env } from './_utils/auth';
import {
  DEFAULT_GEMINI_TEXT_MODEL,
  geminiGenerateText,
  imageBase64ToPart,
  requireDirectGeminiApiKey,
} from './_utils/geminiDirect';

type Body = {
  imageBase64?: string | null;
  contextText?: string;
  contextMode?: 'series' | 'template';
};

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
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

  if (imageBase64) {
    const imagePart = imageBase64ToPart(imageBase64);
    if (!imagePart) {
      return jsonResponse({ error: 'Invalid image format.' }, 400);
    }
    parts.push(imagePart);
  }
  parts.push({ text: prompt });

  try {
    const apiKey = requireDirectGeminiApiKey(env);
    const textBlock = await geminiGenerateText(apiKey, DEFAULT_GEMINI_TEXT_MODEL, parts, {
      maxOutputTokens: 4096,
      temperature: 0.7,
      responseMimeType: 'application/json',
    });

    try {
      return jsonResponse(parseModelJson(textBlock));
    } catch {
      return jsonResponse(
        { error: 'Model returned invalid JSON.', raw: textBlock.slice(0, 500) },
        502
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 502);
  }
};

export const onRequest: PagesFunction<Env> = async () => methodNotAllowed();
