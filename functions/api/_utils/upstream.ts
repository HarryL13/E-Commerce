// Changes: Prefer proxy vision for product analyze — Direct Google hang was breaking gen fallback.
import { Env } from './auth';
import {
  DEFAULT_GEMINI_TEXT_MODEL,
  geminiGenerateText,
  imageBase64ToPart,
} from './geminiDirect';

export type ProxyConfig = {
  useProxy: true;
  baseUrl: string;
  token: string;
};

export type DirectConfig = {
  useProxy: false;
};

/** Default text model on company LiteLLM gateway (SKU copy without image). */
export const DEFAULT_PROXY_TEXT_MODEL = 'qwen3.6-flash';

/** Default vision model on company LiteLLM gateway (analyze image, SKU with photo). */
export const DEFAULT_PROXY_VISION_MODEL = 'qwen3-vl-flash';

export const PRODUCT_ANALYZE_PROMPT =
  'Identify the main product in this image for e-commerce photography. Output ONLY a short descriptor: product name plus key visual traits (material, color, finish, style). Examples: "matte black ceramic vase", "pink vinyl action figure", "brushed silver watch". No full sentences.';

const ANALYZE_TIMEOUT_MS = 25_000;
const PROXY_CHAT_TIMEOUT_MS = 45_000;

/** Google Generative Language API keys from AI Studio start with AIza. */
export function isGoogleGenerativeApiKey(key: string): boolean {
  return key.trim().startsWith('AIza');
}

/** Personal Google key for all direct Gemini calls (text, vision, image). */
export function resolveDirectGeminiApiKey(env: Env): string | undefined {
  const direct = env.GEMINI_DIRECT_API_KEY?.trim();
  if (direct) return direct;

  const gemini = env.GEMINI_API_KEY?.trim();
  if (gemini && isGoogleGenerativeApiKey(gemini)) return gemini;

  return undefined;
}

/** @deprecated Use resolveDirectGeminiApiKey */
export const resolveDirectGeminiImageKey = resolveDirectGeminiApiKey;

function resolveProxyAuthToken(env: Env): string | undefined {
  const candidates = [
    env.API_AUTH_TOKEN,
    env.ANTHROPIC_AUTH_TOKEN,
    env.OPENAI_API_KEY,
    env.ANTHROPIC_API_KEY,
    env.GEMINI_API_KEY,
  ];

  for (const candidate of candidates) {
    const token = candidate?.trim();
    if (token && !isGoogleGenerativeApiKey(token)) return token;
  }
  return undefined;
}

export function resolveProxyConfig(env: Env): ProxyConfig | DirectConfig {
  const baseUrl = (env.API_BASE_URL || env.ANTHROPIC_BASE_URL || '').replace(/\/$/, '');
  const token = resolveProxyAuthToken(env);

  if (baseUrl && token) {
    return { useProxy: true, baseUrl, token };
  }
  return { useProxy: false };
}

export function resolveAuthToken(env: Env): string | undefined {
  return (
    env.API_AUTH_TOKEN ||
    env.ANTHROPIC_AUTH_TOKEN ||
    env.OPENAI_API_KEY ||
    env.GEMINI_API_KEY ||
    env.ANTHROPIC_API_KEY
  );
}

export function getProxyTextModel(env: Env): string {
  return env.PROXY_TEXT_MODEL?.trim() || DEFAULT_PROXY_TEXT_MODEL;
}

export function getProxyVisionModel(env: Env): string {
  return env.PROXY_VISION_MODEL?.trim() || DEFAULT_PROXY_VISION_MODEL;
}

export async function proxyChatCompletion(
  env: Env,
  model: string,
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>,
  options: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {}
): Promise<string> {
  const proxy = resolveProxyConfig(env);
  if (!proxy.useProxy) {
    throw new Error('Proxy is not configured.');
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? PROXY_CHAT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let upstream: Response;
  try {
    upstream = await fetch(`${proxy.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${proxy.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content }],
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.7,
      }),
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Proxy chat timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const raw = await upstream.text();
  if (!upstream.ok) {
    throw new Error(`Proxy upstream ${upstream.status}: ${raw.slice(0, 500)}`);
  }

  const json = JSON.parse(raw);
  const text = json?.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error(`No text content from model. Raw: ${raw.slice(0, 500)}`);
  }
  return text;
}

function toDataUrl(base64Image: string): string {
  if (base64Image.startsWith('data:')) return base64Image;
  return `data:image/png;base64,${base64Image}`;
}

/** Analyze a product photo — proxy vision first when configured (Direct Google often hangs). */
export async function analyzeProductForImageGen(env: Env, base64Image: string): Promise<string> {
  const directKey = resolveDirectGeminiApiKey(env);
  const proxy = resolveProxyConfig(env);
  const imagePart = imageBase64ToPart(base64Image);

  if (proxy.useProxy) {
    try {
      const text = await proxyChatCompletion(
        env,
        getProxyVisionModel(env),
        [
          { type: 'text', text: PRODUCT_ANALYZE_PROMPT },
          { type: 'image_url', image_url: { url: toDataUrl(base64Image) } },
        ],
        { maxTokens: 128, temperature: 0.2, timeoutMs: ANALYZE_TIMEOUT_MS }
      );
      if (text?.trim()) return text.trim();
    } catch {
      // fall through to Direct
    }
  }

  if (directKey && imagePart) {
    try {
      const text = await Promise.race([
        geminiGenerateText(
          directKey,
          DEFAULT_GEMINI_TEXT_MODEL,
          [imagePart, { text: PRODUCT_ANALYZE_PROMPT }],
          { maxOutputTokens: 128, temperature: 0.2 }
        ),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('Direct analyze timed out')), 8_000)
        ),
      ]);
      if (text?.trim()) return text.trim();
    } catch {
      // ignore
    }
  }

  return 'product';
}
