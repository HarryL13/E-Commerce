// Changes: Shared direct Google Gemini API helpers for text and vision (uses GEMINI_DIRECT_API_KEY).
import { Env } from './auth';
import { resolveDirectGeminiApiKey } from './upstream';

export const DEFAULT_GEMINI_TEXT_MODEL = 'gemini-2.5-flash';

export type GeminiPart = {
  text?: string;
  inlineData?: { mimeType: string; data: string };
};

export function requireDirectGeminiApiKey(env: Env): string {
  const key = resolveDirectGeminiApiKey(env);
  if (!key) {
    throw new Error('GEMINI_DIRECT_API_KEY is not set.');
  }
  return key;
}

export function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!matches) return null;
  return { mimeType: matches[1], data: matches[2] };
}

export function imageBase64ToPart(imageBase64: string): GeminiPart | null {
  const parsed = parseDataUrl(imageBase64);
  if (parsed) {
    return { inlineData: { mimeType: parsed.mimeType, data: parsed.data } };
  }

  const commaIdx = imageBase64.indexOf(',');
  if (commaIdx === -1) return null;
  const header = imageBase64.slice(0, commaIdx);
  const data = imageBase64.slice(commaIdx + 1);
  const mimeMatch = header.match(/data:([^;]+);base64/);
  const mimeType = mimeMatch?.[1] || 'image/png';
  return { inlineData: { mimeType, data } };
}

export async function geminiGenerateText(
  apiKey: string,
  model: string,
  parts: GeminiPart[],
  options: {
    maxOutputTokens?: number;
    temperature?: number;
    responseMimeType?: string;
  } = {}
): Promise<string> {
  const generationConfig: Record<string, unknown> = {
    temperature: options.temperature ?? 0.7,
    maxOutputTokens: options.maxOutputTokens ?? 4096,
  };
  if (options.responseMimeType) {
    generationConfig.responseMimeType = options.responseMimeType;
  }

  const upstream = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig,
      }),
    }
  );

  const raw = await upstream.text();
  if (!upstream.ok) {
    throw new Error(`Gemini upstream ${upstream.status}: ${raw.slice(0, 500)}`);
  }

  const json = JSON.parse(raw);
  const text: string | undefined = json?.candidates?.[0]?.content?.parts?.find(
    (p: { text?: string }) => typeof p?.text === 'string'
  )?.text;

  if (!text?.trim()) {
    throw new Error(`No text content from model. Raw: ${raw.slice(0, 500)}`);
  }
  return text.trim();
}
