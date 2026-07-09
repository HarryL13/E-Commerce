// Changes: POD title = JuJuBit pipe format (Name | Tagline); FIG-POD only in variant SKUs, not title.
import { jsonResponse, requireAuth, methodNotAllowed, Env } from './_utils/auth';
import {
  DEFAULT_GEMINI_TEXT_MODEL,
  geminiGenerateText,
  imageBase64ToPart,
  requireDirectGeminiApiKey,
} from './_utils/geminiDirect';

type SkuLine = 'pod' | 'bulk';

type Body = {
  imageBase64?: string | null;
  contextText?: string;
  contextMode?: 'series' | 'template';
  skuLine?: SkuLine;
};

function titleRules(skuLine?: SkuLine): string {
  if (skuLine === 'pod') {
    return `CRITICAL — PRODUCT TITLE (POD listing, JuJuBit store style):
The "title" MUST use pipe separator: "[Character/Product Descriptor] | [Marketing tagline]"
Examples:
- "Custom Figurine of Yourself | Turn Your Photo into a 3D Printed Figure"
- "Custom Hogwarts Student Figurine | Create Your Own 3D Printed Collectible Figure"
- NEVER include "FIG-POD", SKU codes, or sizes in the title — those belong in variant SKUs only (FIG-POD-4cm etc.)
The "handle" must be a URL-friendly slug derived from the title (no "fig-pod" prefix unless natural).`;
  }

  if (skuLine === 'bulk') {
    return `CRITICAL — PRODUCT TITLE (Bulk / 大货):
The "title" MUST be a clean descriptive product name (e.g. "Tactical Operator Action Figure").
- Do NOT include FIG-POD, REG, or SKU codes in the title
The "handle" must be a URL-friendly slug.`;
  }

  return `CRITICAL — PRODUCT TITLE:
Analyze the image and ${'context'} below. Write a professional Shopify product title appropriate for the series type described in the context.
Do NOT put SKU codes (FIG-POD, REG) in the title unless the context explicitly requires a different format.
The "handle" must be a URL-friendly slug.`;
}

function buildPrompt(contextMode: 'series' | 'template', contextText: string, skuLine?: SkuLine) {
  return `You are an expert Shopify product copywriter and SEO specialist.
Based on the provided image and the overall ${contextMode} information, generate comprehensive product listing details.

${titleRules(skuLine)}

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

function inferSkuLine(contextText: string): SkuLine | undefined {
  if (/FIG-POD Print-on-Demand|Variant SKU format: FIG-POD/i.test(contextText)) return 'pod';
  if (/大货|Bulk \/ Wholesale|REG SKU/i.test(contextText)) return 'bulk';
  return undefined;
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

  const { imageBase64, contextText, contextMode, skuLine: bodySkuLine } = body;
  if (contextMode !== 'series' && contextMode !== 'template') {
    return jsonResponse({ error: 'Invalid contextMode.' }, 400);
  }
  if (typeof contextText !== 'string') {
    return jsonResponse({ error: 'Missing contextText.' }, 400);
  }

  const skuLine = bodySkuLine === 'pod' || bodySkuLine === 'bulk'
    ? bodySkuLine
    : inferSkuLine(contextText);

  const prompt = buildPrompt(contextMode, contextText, skuLine);
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
