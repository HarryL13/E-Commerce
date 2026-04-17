// Changes:
// - Cloudflare Pages Functions version of the auth helper. Returns either
//   null (if authenticated) or a Response to immediately return from the
//   caller. Usage pattern:
//     const denied = requireAuth(request, env);
//     if (denied) return denied;
// - Uses Web standard Request / Response instead of Vercel's VercelRequest
//   / VercelResponse since Cloudflare runs on the Workers runtime.

export const PASSWORD_HEADER = 'x-app-password';

export interface Env {
  APP_PASSWORD?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_BASE_URL?: string;
  ANTHROPIC_AUTH_TOKEN?: string;
  GEMINI_API_KEY?: string;
}

export function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
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
