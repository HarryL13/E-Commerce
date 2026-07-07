// Changes: Gemini image gen uses direct Google API only (GEMINI_DIRECT_API_KEY).
import { Env } from './auth';
import { resolveDirectGeminiApiKey } from './upstream';

export const GEMINI_IMAGE_MODELS = new Set([
  'gemini-3.1-flash-image',
  'gemini-3.1-flash-image-preview',
  'gemini-2.5-flash-image-preview',
  'gemini-3-pro-image-preview',
  'gemini-2.5-flash-image',
]);

export const OPENAI_IMAGE_MODELS = new Set(['gpt-image-1', 'gpt-image-2']);

export const SUPPORTED_IMAGE_MODELS = new Set([
  ...GEMINI_IMAGE_MODELS,
  ...OPENAI_IMAGE_MODELS,
]);

export type ImageGenRequest = {
  prompt: string;
  aspectRatio: string;
  model: string;
  referenceImage?: string;
  referenceImages?: string[];
};

function mapAspectRatioToOpenAiSize(aspectRatio: string): string {
  switch (aspectRatio) {
    case '3:4':
    case '9:16':
      return '1024x1536';
    case '4:3':
    case '16:9':
      return '1536x1024';
    default:
      return '1024x1024';
  }
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!matches) return null;
  return { mimeType: matches[1], data: matches[2] };
}

function dataUrlToBlob(dataUrl: string): { blob: Blob; ext: string } | null {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;
  const binary = atob(parsed.data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const ext =
    parsed.mimeType.includes('jpeg') || parsed.mimeType.includes('jpg') ? 'jpg' : 'png';
  return { blob: new Blob([bytes], { type: parsed.mimeType }), ext };
}

function collectReferenceImages(body: ImageGenRequest): string[] {
  if (Array.isArray(body.referenceImages) && body.referenceImages.length > 0) {
    return body.referenceImages.filter((img) => typeof img === 'string');
  }
  if (body.referenceImage) return [body.referenceImage];
  return [];
}

function extractImageFromGeminiJson(g: any): string | null {
  const parts = g?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;

  for (const part of parts) {
    if (part?.inlineData?.data) {
      const mime = part.inlineData.mimeType || 'image/png';
      return `data:${mime};base64,${part.inlineData.data}`;
    }
  }

  for (const part of parts) {
    const text = part?.text;
    if (typeof text === 'string') {
      const match = text.match(/data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)/);
      if (match) {
        const b64 = match[2].replace(/\s/g, '');
        return `data:${match[1]};base64,${b64}`;
      }
    }
  }
  return null;
}

async function generateViaProxyImagesApi(
  baseUrl: string,
  token: string,
  body: ImageGenRequest
): Promise<string> {
  const size = mapAspectRatioToOpenAiSize(body.aspectRatio);
  const payload: Record<string, unknown> = {
    model: body.model,
    prompt: body.prompt,
    size,
    quality: 'high',
    response_format: 'b64_json',
  };

  if (GEMINI_IMAGE_MODELS.has(body.model)) {
    payload.extra_body = {
      image_config: {
        aspect_ratio: body.aspectRatio,
      },
    };
  }

  const upstream = await fetch(`${baseUrl}/v1/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const raw = await upstream.text();
  if (!upstream.ok) {
    throw { message: `Proxy images ${upstream.status}`, raw: raw.slice(0, 500) };
  }

  const json = JSON.parse(raw);
  const b64 = json?.data?.[0]?.b64_json;
  if (typeof b64 === 'string' && b64.length > 0) {
    return `data:image/png;base64,${b64}`;
  }
  throw { message: 'No image data in proxy generations response.', raw: raw.slice(0, 500) };
}

async function generateViaProxyGeminiNative(
  baseUrl: string,
  token: string,
  body: ImageGenRequest,
  referenceImages: string[]
): Promise<string> {
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
  for (const img of referenceImages) {
    const parsed = parseDataUrl(img);
    if (parsed) {
      parts.push({ inlineData: { mimeType: parsed.mimeType, data: parsed.data } });
    }
  }
  parts.push({ text: body.prompt });

  const upstream = await fetch(
    `${baseUrl}/v1beta/models/${body.model}:generateContent`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: body.aspectRatio,
          },
        },
      }),
    }
  );

  const raw = await upstream.text();
  if (!upstream.ok) {
    throw { message: `Proxy Gemini ${upstream.status}`, raw: raw.slice(0, 500) };
  }

  const json = JSON.parse(raw);
  const image = extractImageFromGeminiJson(json);
  if (image) return image;
  throw { message: 'No image data in proxy Gemini response.', raw: raw.slice(0, 500) };
}

async function generateViaGeminiNative(
  apiKey: string,
  body: ImageGenRequest,
  referenceImages: string[]
): Promise<string> {
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
  for (const img of referenceImages) {
    const parsed = parseDataUrl(img);
    if (parsed) {
      parts.push({ inlineData: { mimeType: parsed.mimeType, data: parsed.data } });
    }
  }
  parts.push({ text: body.prompt });

  const upstream = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${body.model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: body.aspectRatio,
          },
        },
      }),
    }
  );

  const raw = await upstream.text();
  if (!upstream.ok) {
    throw { message: `Gemini upstream ${upstream.status}`, raw: raw.slice(0, 500) };
  }

  const json = JSON.parse(raw);
  const image = extractImageFromGeminiJson(json);
  if (image) return image;
  throw { message: 'No image data in Gemini response.', raw: raw.slice(0, 500) };
}

async function generateViaOpenAiNative(
  apiKey: string,
  body: ImageGenRequest,
  referenceImages: string[]
): Promise<string> {
  const size = mapAspectRatioToOpenAiSize(body.aspectRatio);

  let upstream: Response;
  if (referenceImages.length > 0) {
    const form = new FormData();
    form.append('model', body.model);
    form.append('prompt', body.prompt);
    form.append('size', size);
    form.append('quality', 'high');
    form.append('input_fidelity', 'high');

    for (let i = 0; i < referenceImages.length; i++) {
      const parsed = dataUrlToBlob(referenceImages[i]);
      if (parsed) {
        form.append('image[]', parsed.blob, `reference-${i}.${parsed.ext}`);
      }
    }

    upstream = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
  } else {
    upstream = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: body.model,
        prompt: body.prompt,
        size,
        quality: 'high',
        response_format: 'b64_json',
      }),
    });
  }

  const raw = await upstream.text();
  if (!upstream.ok) {
    throw { message: `OpenAI upstream ${upstream.status}`, raw: raw.slice(0, 500) };
  }

  const json = JSON.parse(raw);
  const b64 = json?.data?.[0]?.b64_json;
  if (typeof b64 === 'string' && b64.length > 0) {
    return `data:image/png;base64,${b64}`;
  }
  throw { message: 'No image data in OpenAI response.', raw: raw.slice(0, 500) };
}

export async function generateImageDataUrl(env: Env, body: ImageGenRequest): Promise<string> {
  const referenceImages = collectReferenceImages(body);

  if (GEMINI_IMAGE_MODELS.has(body.model)) {
    const directKey = resolveDirectGeminiApiKey(env);
    if (!directKey) {
      throw { message: 'GEMINI_DIRECT_API_KEY is not set.' };
    }
    return generateViaGeminiNative(directKey, body, referenceImages);
  }

  if (OPENAI_IMAGE_MODELS.has(body.model)) {
    const proxyToken =
      env.API_AUTH_TOKEN?.trim() ||
      env.ANTHROPIC_AUTH_TOKEN?.trim() ||
      env.ANTHROPIC_API_KEY?.trim();
    const apiKey = env.OPENAI_API_KEY?.trim();
    if (!apiKey || (proxyToken && apiKey === proxyToken)) {
      throw {
        message: 'Set a personal OPENAI_API_KEY for gpt-image models, or switch to a Gemini model.',
      };
    }
    return generateViaOpenAiNative(apiKey, body, referenceImages);
  }

  throw { message: 'Invalid model.' };
}
