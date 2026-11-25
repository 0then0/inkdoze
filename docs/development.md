# Development and hosting

InkDoze is a static TypeScript and Preact app built with Vite. The browser runs the image pipeline in Web Workers and loads the bundled WebAssembly decoder when it needs the HEIC fallback.

## Set up a checkout

Install Git, Node.js 24 and npm to match the CI environment. [`.nvmrc`](../.nvmrc)

```sh
git clone https://github.com/0then0/inkdoze.git
cd inkdoze
npm ci
npm run dev
```

Open [localhost:5173](http://localhost:5173/). The development server reloads after edits. Use a production build to check offline reopening.

## Checks and tests

`npm run check` runs catalog validation, type checks, lint, unit tests and the production build. Run it before opening a pull request. The individual commands are available when working on one area.

- `npm run catalog:check` validates device records, installation methods and links to message keys.
- `npm run typecheck` checks the app and tooling with the TypeScript native compiler. The project also installs the JavaScript TypeScript package for typescript-eslint, so use this script to select the intended compiler.
- `npm run lint` runs ESLint.
- `npm test` runs the Vitest unit tests. `npm run test:watch` watches for edits.
- `npm run build` generates `dist/`.

Install Playwright's browsers in a new setup, then run the browser suite. On Linux, the CI workflow uses `npx playwright install --with-deps chromium firefox webkit` to install browser system dependencies as well. [CI workflow](../.github/workflows/ci.yml)

```sh
npx playwright install chromium firefox webkit
npm run test:e2e
```

Playwright serves the production build under `/inkdoze/`. It checks real image downloads and control pixels, installation-dependent output, offline reopening, processing profile transfer and layouts in all seven languages. The HEIC, CrossPoint overlay and offline suites also run in Firefox and WebKit. [Browser projects](../playwright.config.ts) · [Browser tests](../e2e)

Run a single spec by passing its path, for example `npm run test:e2e -- e2e/locales.spec.ts`. The default preview and test server use port `4173`.

## Hosting

```sh
npm run build
npm run preview -- --host 127.0.0.1 --base /inkdoze/
```

Open [127.0.0.1:4173/inkdoze/](http://127.0.0.1:4173/inkdoze/) to test production features, including preparing and reopening offline. For a local production preview at the root, run `npm run preview` after building.

Publish the contents of `dist/` on an HTTPS static host. Standard use supports a domain root or subdirectory through relative asset URLs. To offer offline preparation, serve the build at `/inkdoze/` with `sw.js` next to `index.html`. Keep the asset paths and generated licence files intact. [Offline entry point](../src/offline/client.ts)

The GitHub Pages workflow publishes `dist/` after successful CI for a push to `main`. For a fork, enable **GitHub Actions** under **Settings › Pages › Build and deployment › Source**. The workflow can also be run manually. A Pages project named `inkdoze` uses the `/inkdoze/` path expected by the service worker. [Pages workflow](../.github/workflows/pages.yml) · [GitHub Pages settings](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#publishing-with-a-custom-github-actions-workflow)

## Application boundaries

The production page uses `connect-src 'none'` to block connections from page scripts through APIs such as Fetch and WebSocket. Offline preparation runs in a scoped service worker. It downloads the static build files, checks their digests and media types, and saves a separate cache for each complete build. An update activates after the previous build's tabs close. [Build configuration](../vite.config.ts) · [Service worker](../src/offline/service-worker.ts)

Processing profiles use IndexedDB. Save and import check the collection limit and name within the transaction that writes the record. The portable JSON identifier is `inkdoze.processing-profile`, with format version `1`. Its version is independent of the IndexedDB record. [Profile storage and file validation](../src/ui/profiles.ts) · [User guide for profiles](user-guide.md#reuse-batch-settings)

## Project layout

- Device records, sources and validation. [`src/catalog/`](../src/catalog)
- Geometry, tone, dithering and the shared preview and export renderer. [`src/pipeline/`](../src/pipeline)
- File probing, processing limits and task queue. [`src/io/`](../src/io)
- BMP, PXC, ZIP and EPUB encoders and the format registry. [`src/formats/`](../src/formats)
- Render and HEIC workers. [`src/worker/`](../src/worker)
- Offline preparation and the service worker. [`src/offline/`](../src/offline)
- Preact interface, application state and processing profiles. [`src/ui/`](../src/ui)
- Translations and message formatting. [`src/i18n/`](../src/i18n)
- Vitest unit tests and Playwright browser tests. [`tests/`](../tests) · [`e2e/`](../e2e)
