// Changes: Shared helper to read Cloudflare `.dev.vars` for local Vite auth middleware.
import fs from 'fs';
import path from 'path';

export function loadDevVars(rootDir = process.cwd()): Record<string, string> {
  const filePath = path.resolve(rootDir, '.dev.vars');
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const vars: Record<string, string> = {};
  const content = fs.readFileSync(filePath, 'utf8');

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }

  return vars;
}
