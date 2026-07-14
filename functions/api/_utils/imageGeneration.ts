// Changes: Fast-fail Direct Gemini (8s) when proxy exists so CF 30s wall-time doesn't kill
// requests before proxy fallback; map non-preview model ids to proxy-valid *-preview names.
import { Env } from './auth';
import {
  analyzeProductForImageGen,
  resolveDirectGeminiApiKey,
  resolveProxyConfig,
} from './upstream';

export type GeminiImageSize = '1K' | '2K';
export const DEFAULT_GEMINI_IMAGE_SIZE: GeminiImageSize = '1K';
export const PROXY_IMAGE_QUALITY = 'high';

export function normalizeImageSize(value: unknown): GeminiImageSize {
  return value === '2K' ? '2K' : DEFAULT_GEMINI_IMAGE_SIZE;
}

/** Lumina/LiteLLM only lists *-preview image models — aliases strip clients use. */
const PROXY_MODEL_ALIASES: Record<string, string> = {
  'gemini-3.1-flash-image': 'gemini-3.1-flash-image-preview',
  'gemini-2.5-flash-image': 'gemini-2.5-flash-image-preview',
  'gemini-3-pro-image': 'gemini-3-pro-image-preview',
};

function mapModelForProxy(model: string): string {
  return PROXY_MODEL_ALIASES[model] || model;
}

export type ImageGenResult = {
  image: string;
  mode?: 'direct-reference' | 'proxy-reference' | 'proxy-text';
};

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
  /** Pre-analyzed product descriptor — used for local proxy fallback. */
  productDescription?: string;
  /** Skip slow direct Google calls; use company proxy (recommended locally). */
  preferProxy?: boolean;
  /** Gemini output resolution — 1K (faster) or 2K (sharper). */
  imageSize?: GeminiImageSize;
};

function resolveImageSize(body: ImageGenRequest): GeminiImageSize {
  return normalizeImageSize(body.imageSize);
}

const DIRECT_GEMINI_TIMEOUT_MS = 45_000;
const DIRECT_GEMINI_REFERENCE_TIMEOUT_MS = 120_000;
/**
 * Cloudflare Pages Functions ≈30s total wall time. When a proxy exists, burn at most
 * a few seconds on Direct Google so analyze+proxy still have room to finish.
 */
const DIRECT_GEMINI_REFERENCE_FAST_TIMEOUT_MS = 8_000;
const DIRECT_GEMINI_FAST_TIMEOUT_MS = 8_000;
const PROXY_GEMINI_TIMEOUT_MS = 100_000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  label: string
): Promise<Response> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Promise.race so hung sockets still fail even when AbortSignal is ignored.
    return await Promise.race([
      fetch(url, { ...init, signal: controller.signal }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject({
            message: `${label} timed out after ${Math.round(timeoutMs / 1000)}s`,
          });
        }, timeoutMs);
      }),
    ]);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'message' in err) {
      throw err;
    }
    const message =
      err instanceof Error && err.name === 'AbortError'
        ? `${label} timed out after ${Math.round(timeoutMs / 1000)}s`
        : `${label} failed: ${err instanceof Error ? err.message : 'network error'}`;
    throw { message };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function formatUpstreamError(prefix: string, err: unknown): { message: string; raw?: string } {
  if (err && typeof err === 'object' && 'message' in err) {
    const e = err as { message?: string; raw?: string };
    return { message: `${prefix}: ${e.message || 'unknown error'}`, raw: e.raw };
  }
  return { message: `${prefix}: ${String(err)}` };
}

function enrichPromptWithProduct(prompt: string, productDescription?: string): string {
  const desc = productDescription?.trim();
  if (!desc) return prompt;
  return `${prompt}

Exact product to photograph — match shape, colors, materials, logos, and proportions: ${desc}`;
}

async function generateViaProxyImagesWithDescription(
  env: Env,
  body: ImageGenRequest,
  productDescription?: string
): Promise<string> {
  const proxy = resolveProxyConfig(env);
  if (!proxy.useProxy) {
    throw { message: 'Proxy is not configured (set API_BASE_URL + API_AUTH_TOKEN).' };
  }
  return generateViaProxyImagesApi(proxy.baseUrl, proxy.token, {
    ...body,
    prompt: enrichPromptWithProduct(body.prompt, productDescription),
  });
}

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
  const proxyModel = mapModelForProxy(body.model);
  const payload: Record<string, unknown> = {
    model: proxyModel,
    prompt: body.prompt,
    size,
    quality: PROXY_IMAGE_QUALITY,
    response_format: 'b64_json',
  };

  if (GEMINI_IMAGE_MODELS.has(body.model) || GEMINI_IMAGE_MODELS.has(proxyModel)) {
    payload.extra_body = {
      image_config: {
        aspect_ratio: body.aspectRatio,
        image_size: resolveImageSize(body),
      },
    };
  }

  const upstream = await fetchWithTimeout(
    `${baseUrl}/v1/images/generations`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
    PROXY_GEMINI_TIMEOUT_MS,
    'Proxy images API'
  );

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

  const upstream = await fetchWithTimeout(
    `${baseUrl}/v1beta/models/${mapModelForProxy(body.model)}:generateContent`,
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
            imageSize: resolveImageSize(body),
          },
        },
      }),
    },
    PROXY_GEMINI_TIMEOUT_MS,
    'Proxy Gemini'
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
  referenceImages: string[],
  timeoutMs?: number
): Promise<string> {
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
  for (const img of referenceImages) {
    const parsed = parseDataUrl(img);
    if (parsed) {
      parts.push({ inlineData: { mimeType: parsed.mimeType, data: parsed.data } });
    }
  }
  parts.push({ text: body.prompt });

  const effectiveTimeout =
    timeoutMs ??
    (referenceImages.length > 0 ? DIRECT_GEMINI_REFERENCE_TIMEOUT_MS : DIRECT_GEMINI_TIMEOUT_MS);

  const upstream = await fetchWithTimeout(
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
            imageSize: resolveImageSize(body),
          },
        },
      }),
    },
    effectiveTimeout,
    'Direct Gemini API'
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

export async function generateImageResult(env: Env, body: ImageGenRequest): Promise<ImageGenResult> {
  const referenceImages = collectReferenceImages(body);
  const errors: string[] = [];

  if (GEMINI_IMAGE_MODELS.has(body.model)) {
    const directKey = resolveDirectGeminiApiKey(env);
    const proxy = resolveProxyConfig(env);
    // Proxy is reachable in-region; Direct Google often hangs (China / CF wall time).
    // Prefer proxy whenever configured so we never burn the request on a dead Direct call.
    const useProxyFirst = Boolean(proxy.useProxy);

    if (useProxyFirst) {
      try {
        const description =
          body.productDescription?.trim() ||
          (referenceImages.length > 0
            ? await analyzeProductForImageGen(env, referenceImages[0])
            : undefined);
        const image = await generateViaProxyImagesWithDescription(env, body, description);
        return { image, mode: 'proxy-text' };
      } catch (err: unknown) {
        errors.push(formatUpstreamError('Proxy images', err).message);
      }
    }

    if (body.preferProxy && proxy.useProxy && !useProxyFirst) {
      try {
        const image = await generateViaProxyImagesWithDescription(
          env,
          body,
          body.productDescription
        );
        return { image, mode: 'proxy-text' };
      } catch (err: unknown) {
        errors.push(formatUpstreamError('Proxy images (text mode)', err).message);
      }
    }

    if (!useProxyFirst && !body.preferProxy && directKey && referenceImages.length > 0) {
      const directTimeout = proxy.useProxy
        ? DIRECT_GEMINI_REFERENCE_FAST_TIMEOUT_MS
        : DIRECT_GEMINI_REFERENCE_TIMEOUT_MS;
      try {
        const image = await generateViaGeminiNative(
          directKey,
          body,
          referenceImages,
          directTimeout
        );
        return { image, mode: 'direct-reference' };
      } catch (err: unknown) {
        errors.push(formatUpstreamError('Direct Gemini', err).message);
      }
    } else if (!useProxyFirst && !body.preferProxy && directKey && referenceImages.length === 0) {
      const directTimeout = proxy.useProxy ? DIRECT_GEMINI_FAST_TIMEOUT_MS : DIRECT_GEMINI_TIMEOUT_MS;
      try {
        const image = await generateViaGeminiNative(directKey, body, referenceImages, directTimeout);
        return { image, mode: 'direct-reference' };
      } catch (err: unknown) {
        errors.push(formatUpstreamError('Direct Gemini', err).message);
      }
    } else if (!directKey && !proxy.useProxy) {
      errors.push('GEMINI_DIRECT_API_KEY is not set.');
    }

    if (!useProxyFirst && proxy.useProxy && !body.preferProxy && referenceImages.length > 0) {
      try {
        const description =
          body.productDescription?.trim() ||
          (await analyzeProductForImageGen(env, referenceImages[0]));
        const image = await generateViaProxyImagesWithDescription(env, body, description);
        return { image, mode: 'proxy-text' };
      } catch (err: unknown) {
        errors.push(formatUpstreamError('Proxy images (analyzed text)', err).message);
      }
    }

    if (!useProxyFirst && proxy.useProxy && referenceImages.length === 0 && !body.preferProxy) {
      try {
        const image = await generateViaProxyImagesWithDescription(
          env,
          body,
          body.productDescription
        );
        return { image, mode: 'proxy-text' };
      } catch (err: unknown) {
        errors.push(formatUpstreamError('Proxy images API', err).message);
      }
    }

    // Last resort: Direct, after proxy failed
    if (useProxyFirst && directKey) {
      try {
        const image = await generateViaGeminiNative(
          directKey,
          body,
          referenceImages,
          DIRECT_GEMINI_REFERENCE_FAST_TIMEOUT_MS
        );
        return { image, mode: 'direct-reference' };
      } catch (err: unknown) {
        errors.push(formatUpstreamError('Direct Gemini (fallback)', err).message);
      }
    }

    throw {
      message: `Image generation failed. ${errors.join(' · ') || 'No upstream succeeded.'}`,
    };
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
    const image = await generateViaOpenAiNative(apiKey, body, referenceImages);
    return { image };
  }

  throw { message: 'Invalid model.' };
}

export async function generateImageDataUrl(env: Env, body: ImageGenRequest): Promise<string> {
  const result = await generateImageResult(env, body);
  return result.image;
}
