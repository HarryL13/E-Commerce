// Changes: Unified company LiteLLM proxy config — one base URL + bearer token for all providers.
import { Env } from './auth';

export type ProxyConfig = {
  useProxy: true;
  baseUrl: string;
  token: string;
};

export type DirectConfig = {
  useProxy: false;
};

export function resolveProxyConfig(env: Env): ProxyConfig | DirectConfig {
  const baseUrl = (env.API_BASE_URL || env.ANTHROPIC_BASE_URL || '').replace(/\/$/, '');
  const token =
    env.API_AUTH_TOKEN ||
    env.ANTHROPIC_AUTH_TOKEN ||
    env.OPENAI_API_KEY ||
    env.GEMINI_API_KEY ||
    env.ANTHROPIC_API_KEY;

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
