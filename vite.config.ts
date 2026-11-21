import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, transformWithOxc, type Plugin } from 'vite';

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

function offlinePlugin(): Plugin {
  const worker = fileURLToPath(new URL('src/offline/service-worker.ts', import.meta.url));
  return {
    name: 'inkdoze-offline',
    apply: 'build',
    buildStart() {
      this.addWatchFile(worker);
    },
    async writeBundle({ dir }, bundle) {
      if (!dir) this.error('InkDoze needs a build output directory.');
      // The favicon is copied from public/. Read final bytes so hashes also include
      // any source map comments added when Vite writes the JS files.
      const files = ['favicon.svg', ...Object.keys(bundle).filter((name) => !name.endsWith('.map') && !name.startsWith('licenses/'))];
      const precache = await Promise.all(files.sort().map(async (name) => {
        const hash = createHash('sha256').update(await readFile(join(dir, name))).digest('base64');
        return [name.split('/').map(encodeURIComponent).join('/'), `sha256-${hash}`];
      }));
      const { code } = await transformWithOxc(await readFile(worker, 'utf8'), worker, { target: 'es2022' });
      const manifest = JSON.stringify(precache);
      const version = createHash('sha256').update(manifest).update(code).digest('hex');
      await writeFile(join(dir, 'sw.js'), `const buildId = "${version}";\nconst precache = ${manifest};\n${code}`);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [cspPlugin(), licensesPlugin(), offlinePlugin()],
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
