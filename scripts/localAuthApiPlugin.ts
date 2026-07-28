// Changes: Vite dev middleware for POST /api/auth when running UI-only `npm run dev`.
import type { Plugin } from 'vite';
import { loadDevVars } from './loadDevVars';

function readRequestBody(req: import('http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function localAuthApiPlugin(): Plugin {
  return {
    name: 'local-auth-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];
        if (url !== '/api/auth' || req.method !== 'POST') {
          return next();
        }

        const expected = loadDevVars()['APP_PASSWORD']?.trim();
        if (!expected) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error:
                'APP_PASSWORD is not set. Copy .env.example to .dev.vars and set your password.',
            })
          );
          return;
        }

        try {
          const rawBody = await readRequestBody(req);
          const body = JSON.parse(rawBody || '{}') as { password?: unknown };
          const password = typeof body.password === 'string' ? body.password.trim() : '';

          if (!password) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing password.' }));
            return;
          }

          if (password !== expected) {
            res.statusCode = 401;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Incorrect password.' }));
            return;
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true }));
        } catch {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Invalid JSON body.' }));
        }
      });
    },
  };
}
