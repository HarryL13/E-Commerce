// Changes:
// - New helper that reads the saved password from localStorage and attaches
//   it as the x-app-password header on every /api/* fetch. Used by the
//   rewritten service layer so individual callers don't have to think about
//   auth. Also exposes a tiny wrapper `apiFetch` for consistent error UX.

export const AUTH_STORAGE_KEY = 'ecs_auth_v1';

export function getSavedPassword(): string | null {
  try {
    return localStorage.getItem(AUTH_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveSavedPassword(password: string) {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, password);
  } catch {
    // ignore (e.g. privacy mode)
  }
}

export function clearSavedPassword() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export class AuthRequiredError extends Error {
  constructor(message = 'Auth required. Please sign in again.') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

export async function apiFetch<T = any>(
  path: string,
  body: unknown,
  init: Omit<RequestInit, 'body' | 'method' | 'headers'> = {}
): Promise<T> {
  const password = getSavedPassword();
  if (!password) {
    throw new AuthRequiredError();
  }

  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-app-password': password,
    },
    body: JSON.stringify(body ?? {}),
    ...init,
  });

  if (res.status === 401) {
    clearSavedPassword();
    throw new AuthRequiredError();
  }

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    if (!res.ok) throw new Error(`Request failed: HTTP ${res.status}`);
    throw new Error('Invalid JSON response from server.');
  }

  if (!res.ok) {
    throw new Error(json?.error || `Request failed: HTTP ${res.status}`);
  }

  return json as T;
}

export async function verifyPassword(password: string): Promise<boolean> {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return res.ok;
}
