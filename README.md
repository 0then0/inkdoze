<p align="center">
  <img src="docs/icon.svg" width="96" height="96" alt="InkDoze icon: an e-reader with a crescent moon on its screen">
</p>

<h1 align="center">InkDoze</h1>

<p align="center">
  Turn your images into sleep screens for e-readers, right in the browser.
</p>

<p align="center">
  <a href="https://github.com/0then0/inkdoze/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/0then0/inkdoze/ci.yml?branch=main&label=CI" alt="CI status"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/0then0/inkdoze" alt="License: Apache-2.0"></a>
</p>

InkDoze resizes, crops and tones images for the exact screen of your e-reader and tells you how (or whether) the device can use them as a sleep screen. Everything runs locally: after the page loads, no image, file name or metadata leaves your device, and the production build blocks network requests with a Content Security Policy.

**Open it in your browser:** <https://0then0.github.io/inkdoze/>

## How to use

1. Add images: drop PNG, JPEG or WebP files onto the page or choose **Add images**.
2. Pick your e-reader once. Search by model, generation or resolution, or choose **Custom size**. InkDoze remembers the choice for your next visit.
3. Download the selected image, or all images as a ZIP.

That is the whole workflow. **Automatic e-ink adjustment** is on by default: for each image it stretches the contrast and lifts the midtones so it reads well on e-ink, picks colour or grayscale to match the screen, fills the screen at its native resolution and uses the format recommended for the e-reader. The line above the download buttons shows what you will get, for example `480 × 800 px · BMP 24-bit colour · Grayscale`.

**How to install** explains whether the selected model can show your own image at all, which firmware or app that needs, and the file name to use. Everything else is optional: crop, rotate, zoom and position an image under the preview, or open **Manual settings** for size, framing, background, tone, gray levels, dithering and format. **Apply changes to** decides whether a manual setting affects all images or only the selected one.

Limits per batch: 40 files, 40 MB and 40 megapixels per file, output up to 8192 px per side.

## Features

- **Device catalog.** 367 e-readers from 35 brands, from the 2004 Sony Librie to current Kindle, Kobo, BOOX, PocketBook, reMarkable and Xteink models, with generations kept apart. The list is ordered by approximate popularity. Search by model, generation, alias or resolution (`pw5`, `paperwhite 2021`, `1264x1680`), filter by brand and colour screen, or set a custom size.
- **Honest install guidance.** Screen size and install method are separate. Each method has a status (custom image, book cover only, third-party firmware or app, size confirmed only), a community-documented flag where applicable, steps, limitations and sources with the date they were checked.
- **Framing.** Fit, Fill and Stretch; crop with aspect lock (mouse, touch or keyboard); zoom; offset; 90° rotation; background colour for empty and transparent areas.
- **Tone.** Automatic per-image adjustment for e-ink (levels stretch with a capped gain and a midtone curve, measured on the visible part of the image only). Manual colour or grayscale, brightness and contrast on top of it, invert, 256/16/4/2 gray levels and Floyd–Steinberg or Atkinson dithering.
- **Same pipeline for preview and export.** The preview is rendered at full output resolution by the same code that writes the file. The optional e-ink simulation is labelled as an approximation.
- **Formats.** PNG, JPEG and uncompressed BMP at 24, 8, 4, 2 and 1 bit. The recommended format and file name come from the selected install method.
- **Batches.** Drag and drop or pick several PNG, JPEG and WebP files, rename outputs, give single images their own settings, download one file or a ZIP of all. Work runs in a Web Worker with bounded concurrency and can be cancelled.
- **Seven languages.** English, Русский, Español, Deutsch, Français, 日本語 and Português (Brasil).
- **Mobile and keyboard friendly.** Native controls, visible focus, a sticky download bar on phones.

## Catalog at a glance

| Brand | Models | Years | Best documented status |
| --- | ---: | --- | --- |
| Kindle | 27 | 2007–2025 | Book cover on stock firmware; custom images need a jailbreak (Screen Saver Hack on 2.x–4.x firmware, KOReader) |
| Kobo | 25 | 2010–2024 | Book cover; community-documented `.kobo/screensaver` folder; KOReader |
| BOOX | 196 | 2009–2026 | Custom image (Apps › Screensaver) on recent models; «Set as screensaver» on Russian-market models whose manual covers it; Picco via CrossPoint |
| PocketBook | 23 | 2010–2025 | Size only, except Verse Pro firmware 6.9 logos |
| Sony | 15 | 2004–2018 | Size only (Reader PRS series, Digital Paper) |
| tolino | 10 | 2013–2024 | Cover only on 2024 models; own picture on earlier models |
| Bookeen | 8 | 2004–2014 | Size only (Cybook) |
| NOOK | 7 | 2011–2023 | Screensavers folder on early models; size only on later ones |
| reMarkable | 5 | 2017–2026 | Community SSH method |
| Xteink | 4 | 2025–2026 | CrossPoint `sleep.bmp`; stock wallpaper |
| Supernote | 4 | 2020–2024 | Custom image (Settings › Display & Input › Screensaver) |
| 24 other brands | 43 | 2006–2025 | Size only (Bigme, Meebook, Likebook, Boyue, Hanlin, Hanvon, iRex, Icarus and others) |

The data lives in [`src/catalog`](src/catalog) as typed records. Every model has a stable ID, brand, model, generation, aliases, portrait resolution, colour flag, sources and a verification date. Sources are tagged as manufacturer, firmware source, community tooling or secondary. Models backed only by secondary sources are marked in the UI. Every ONYX BOOX model sold in Russia, including the archive (Darwin, Faust, Vasco da Gama, Kon-Tiki, Monte Cristo and others), comes from the specification pages of [onyx-boox.ru](https://onyx-boox.ru/), the official distributor. Most other discontinued models are documented on the [MobileRead Wiki](https://wiki.mobileread.com/), maintained by device owners; where firmware-level data exists (CrossPoint, Plato, KOReader) it takes precedence.

The device list is sorted by an approximate popularity score: brand reach, flagship product lines and how recent the model is. There is no public per-model sales data, so the order is an editorial estimate; the weights live in [`src/catalog/popularity.ts`](src/catalog/popularity.ts). Recency is counted from the current year, so the order ages on its own.

Data notes:

- Kindle Paperwhite (12th generation) and Colorsoft render at **1272 × 1696**. Many spec sheets say 1264 × 1680; device screenshots collected by the Kindle Comic Converter project show the larger grid.
- Note Air3 (1404 × 1872) and Note Air3 C (1860 × 2480) share a name but not a resolution, as do Paperwhite generations 5 (1236 × 1648) and 6.
- Current tolino models (2024, built with Kobo) only show the book cover; the "own picture" option belongs to earlier generations.

### CrossPoint and PXC

CrossPoint 2.0.0 ships builds for Xteink X3/X4, X4 Classic, X4 Pro and BOOX Picco. Custom sleep images are `sleep.bmp` in the SD card root or `.bmp` files in `/.sleep`, read as uncompressed BMP (1, 2, 4, 8, 24 or 32 bit, up to 2048 × 3072). InkDoze writes BMP variants that pass a port of CrossPoint's header checks; 24-bit is recommended as in the CrossPoint guide, and 2-bit stores exactly the four native gray levels.

PXC sleep images are only implemented in an [unmerged pull request](https://github.com/crosspoint-reader/crosspoint-reader/pull/1614); released firmware uses the `.pxc` layout only as an internal cache. InkDoze contains a tested PXC encoder for that layout, but does not offer it for any device until a release reads PXC sleep images.

## Browser support

InkDoze needs `OffscreenCanvas`, module Web Workers and `createImageBitmap`, which current versions of Chrome, Edge, Firefox and Safari provide. The automated tests run in Chromium (desktop and Android emulation); other browsers are not tested in CI.

## Run locally

Requirements: Node.js 22.12 or newer (CI uses the version in [`.nvmrc`](.nvmrc)) and npm.

```bash
npm ci
```

Development server with hot reload at <http://localhost:5173/>:

```bash
npm run dev
```

Production build served locally at <http://localhost:4173/>:

```bash
npm run build && npm run preview
```

| Command                 | What it does                                     |
| ----------------------- | ------------------------------------------------ |
| `npm run catalog:check` | Validates the device catalog and install methods |
| `npm run typecheck`     | TypeScript 7 type check of the app and tooling   |
| `npm run lint`          | ESLint                                           |
| `npm test`              | Unit tests (Vitest)                              |
| `npm run build`         | Production build into `dist/`                    |
| `npm run test:e2e`      | Playwright tests against the production build    |
| `npm run check`         | Everything except Playwright                     |

Install the Playwright browser once with `npx playwright install chromium`.

## Hosting

`npm run build` writes a static site to `dist/`. All paths are relative, so it works from a domain root or any sub-directory on any static host.

The repository deploys itself to GitHub Pages with [`.github/workflows/pages.yml`](.github/workflows/pages.yml): after the CI workflow succeeds on `main`, the site is built and published to `https://<owner>.github.io/inkdoze/`. To enable it in a fork, open **Settings › Pages** and set **Source** to **GitHub Actions**; until then the workflow skips deployment with a notice. You can also run it manually from the **Actions** tab.

### Project layout

```
src/catalog/   devices, install methods, sources, validation
src/pipeline/  geometry, tone and dithering, render job, canvas renderer
src/formats/   BMP, PXC and ZIP writers, format registry
src/io/        header probing, limits, file names, task queue
src/worker/    render worker and its client
src/i18n/      translator and locale files
src/ui/        Preact components
tests/         unit tests
e2e/           Playwright tests
```

### Tests

Unit tests cover catalog validation (duplicates, incomplete records, wrong orientation, unknown methods or message keys), geometry (crop, rotation, placement, clipping), transparency, tone curves, palettes and dithering, BMP and PXC packing and row alignment checked against independent readers, ZIP structure against zlib's CRC-32, header probing, the task queue and locale completeness.

Playwright runs against the production build served from `/inkdoze/`, as on GitHub Pages. It converts real files end to end, decodes the downloads with the browser's own decoders and checks sizes and control pixels, verifies ZIP contents, per-file settings, error reporting, cancellation, offline use after load, and layout in all seven languages at desktop, tablet and phone widths.

## Contributing

Corrections to the catalog are the most valuable contribution. See [CONTRIBUTING.md](CONTRIBUTING.md) for what sources a model or install method needs.

## License

[Apache License 2.0](LICENSE)
