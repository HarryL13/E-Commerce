// Changes:
// - Trim password values before compare (env vars often have trailing newlines).
// - Cloudflare Pages Function version of POST /api/auth. Same semantics as
//   the Vercel version: body {password} vs env.APP_PASSWORD; 200 if match,
//   401 otherwise.
import { jsonResponse, methodNotAllowed, Env } from './_utils/auth';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const expected = env.APP_PASSWORD?.trim();
  if (!expected) {
    return jsonResponse(
      { error: 'Server misconfiguration: APP_PASSWORD is not set.' },
      500
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const password = typeof body?.password === 'string' ? body.password.trim() : '';
  if (password.length === 0) {
    return jsonResponse({ error: 'Missing password.' }, 400);
  }

  if (password !== expected) {
    return jsonResponse({ error: 'Incorrect password.' }, 401);
  }

  return jsonResponse({ ok: true });
};

// Reject other methods
export const onRequest: PagesFunction<Env> = async () => methodNotAllowed();
