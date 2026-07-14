// Changes: jsonResponse sends Cache-Control no-store so Shopify catalog isn't mid-cached.
//   null (if authenticated) or a Response to immediately return from the
//   caller. Usage pattern:
//     const denied = requireAuth(request, env);
//     if (denied) return denied;
// - Uses Web standard Request / Response instead of Vercel's VercelRequest
//   / VercelResponse since Cloudflare runs on the Workers runtime.

export const PASSWORD_HEADER = 'x-app-password';

export interface Env {
  APP_PASSWORD?: string;
  API_BASE_URL?: string;
  API_AUTH_TOKEN?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_BASE_URL?: string;
  ANTHROPIC_AUTH_TOKEN?: string;
  GEMINI_API_KEY?: string;
  /** Personal Google key — Gemini image gen uses this directly (skips company proxy). */
  GEMINI_DIRECT_API_KEY?: string;
  OPENAI_API_KEY?: string;
  /** Override proxy chat model for text-only tasks (default qwen3.6-flash). */
  PROXY_TEXT_MODEL?: string;
  /** Override proxy chat model for vision tasks (default qwen3-vl-flash). */
  PROXY_VISION_MODEL?: string;
  /** Shopify Admin API — product publish from SKU Generator. */
  SHOPIFY_ACCESS_TOKEN?: string;
  SHOPIFY_STORE_NAME?: string;
}

export function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      ...extraHeaders,
    },
  });
}

export function requireAuth(request: Request, env: Env): Response | null {
  const expected = env.APP_PASSWORD;
  if (!expected) {
    return jsonResponse(
      { error: 'Server misconfiguration: APP_PASSWORD is not set.' },
      500
    );
  }
  const provided = request.headers.get(PASSWORD_HEADER);
  if (!provided || provided !== expected) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }
  return null;
}

export function methodNotAllowed(allowed: string[] = ['POST']): Response {
  return jsonResponse({ error: 'Method Not Allowed' }, 405, {
    Allow: allowed.join(', '),
  });
}
