// Changes: Proxy model IDs — gemini-3-flash removed from gateway; use qwen3.6-flash / qwen3-vl-flash.
// Direct Gemini image key detection (GEMINI_DIRECT_API_KEY or AIza-prefixed GEMINI_API_KEY).
import { Env } from './auth';

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

/** Google Generative Language API keys from AI Studio start with AIza. */
export function isGoogleGenerativeApiKey(key: string): boolean {
  return key.trim().startsWith('AIza');
}

/** Personal Google key for direct Gemini image calls (bypasses company proxy). */
export function resolveDirectGeminiImageKey(env: Env): string | undefined {
  const direct = env.GEMINI_DIRECT_API_KEY?.trim();
  if (direct) return direct;

  const gemini = env.GEMINI_API_KEY?.trim();
  if (gemini && isGoogleGenerativeApiKey(gemini)) return gemini;

  return undefined;
}

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
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const proxy = resolveProxyConfig(env);
  if (!proxy.useProxy) {
    throw new Error('Proxy is not configured.');
  }

  const upstream = await fetch(`${proxy.baseUrl}/v1/chat/completions`, {
    method: 'POST',
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
