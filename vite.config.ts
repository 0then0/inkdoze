import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

// Production builds ship a strict Content-Security-Policy: the app may only load
// its own static files, and connect-src 'none' blocks fetch/XHR/WebSocket so image
// data and metadata cannot leave the browser.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "worker-src 'self' blob:",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

function cspPlugin(): Plugin {
  return {
    name: 'inkdoze-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

// The HEIC decoder chunk is LGPL-licensed libheif: ship its license text and the
// third-party notices next to the app.
function licensesPlugin(): Plugin {
  return {
    name: 'inkdoze-licenses',
    apply: 'build',
    generateBundle() {
      const files = {
        'licenses/libheif.txt': 'node_modules/libheif-js/libheif-wasm/LICENSE',
        'licenses/third-party.txt': 'THIRD_PARTY_NOTICES.txt',
      };
      for (const [fileName, source] of Object.entries(files)) {
        this.emitFile({ type: 'asset', fileName, source: readFileSync(new URL(source, import.meta.url)) });
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [cspPlugin(), licensesPlugin()],
  oxc: {
    jsx: { runtime: 'automatic', importSource: 'preact' },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    assetsInlineLimit: 0,
  },
  worker: {
    format: 'es',
  },
});
