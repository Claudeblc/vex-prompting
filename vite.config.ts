import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages ne sait pas envoyer d'en-têtes : la politique de sécurité part aussi
// dans une balise meta, au build seulement (le serveur de dev a besoin de scripts en ligne).
// Même politique que public/_headers, moins frame-ancestors qu'une balise meta ignore.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "font-src 'self'",
  "img-src 'self'",
  'connect-src https://api.mistral.ai https://api.groq.com https://api.openai.com',
  "media-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  'upgrade-insecure-requests',
].join('; ');

function contentSecurityPolicy(): Plugin {
  return {
    name: 'vex-prompting-csp',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY }, injectTo: 'head-prepend' },
    ],
  };
}

export default defineConfig({
  // Chemins relatifs : le même build marche à la racine d'un domaine comme dans /vex-prompting/ (GitHub Pages).
  base: './',
  plugins: [react(), contentSecurityPolicy()],
  server: { host: '127.0.0.1', port: 5181, strictPort: true },
  preview: { host: '127.0.0.1', port: 5182, strictPort: true },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
