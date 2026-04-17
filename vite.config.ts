// Changes:
// - Removed ANTHROPIC_API_KEY / GEMINI_API_KEY / API_KEY / APP_PASSWORD from
//   Vite's `define`. These are now server-side-only env vars consumed by the
//   /api serverless functions; injecting them into the browser bundle would
//   defeat the whole point of the proxy.
// - Kept the @google/genai alias and server options untouched.
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@google/genai': path.resolve(__dirname, 'node_modules/@google/genai/dist/web/index.mjs')
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
