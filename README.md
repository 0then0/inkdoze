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

InkDoze resizes, crops and tones images for the exact screen of your e-reader and tells you how (or whether) the device can use them as a sleep screen. All image processing runs locally. The production page's Content Security Policy blocks connections from the page.

**Open it in your browser:** <https://0then0.github.io/inkdoze/>

## How to use

1. Add images: drop PNG, JPEG, WebP or HEIC files onto the page or choose **Add images**. HEIC photos can be added as they are.
2. Pick your e-reader once. Search by model, generation or resolution, or choose **Custom size**. InkDoze remembers the choice for your next visit.
3. Download the selected image, or all images as a ZIP. For Kindles that only show book covers, download an EPUB instead (see below).

That is the whole workflow. **Automatic e-ink adjustment** is on by default: for each image it stretches the contrast and lifts the midtones so it reads well on e-ink, picks colour or grayscale to match the screen, fills the screen at its native resolution and uses the format recommended for the e-reader. The line above the download buttons shows what you will get, for example `480 × 800 px · BMP 24-bit colour · Grayscale`.

**How to install** explains whether the selected model can show your own image at all, which firmware or app that needs, and the file name to use. Everything else is optional: crop, rotate, zoom and position an image under the preview, or open **Manual settings** for size, framing, background, tone, gray levels, dithering and format. **Apply changes to** decides whether a manual setting affects all images or only the selected one.

For transparent overlays on CrossPoint 2.0.0, follow the [sleep overlay steps](#crosspoint-sleep-overlay).

Limits per batch: 40 files, 40 MB and 40 megapixels per file, output up to 8192 px per side.

### Reuse batch settings

In **Processing profiles**, choose **Save batch settings as a profile** and enter a name. The list shows profiles for the selected reader (or **Custom size**) and output mode. Choose a profile and select **Apply profile** to update the batch settings. You can also rename or delete the selected profile.

Standard profiles save the output dimensions, fit, background, tone, colour, gray levels, dithering, format and JPEG quality settings for the batch. CrossPoint sleep overlay profiles save only the fit setting. The selected reader determines the overlay size and export uses transparent PNG. Individual images keep their framing, file names and overrides. Per-image settings take priority in both preview and export.

You can save up to 40 profiles with names of up to 64 characters. The browser stores profiles in site data, separate from the offline app cache. Profiles are available when you reopen the prepared app offline in the same browser profile. Clearing site data deletes saved profiles.

## Open InkDoze offline

1. While online, open `/inkdoze/`. Select **Offline** next to the language picker, then choose **Prepare for offline use**. This saves the app files, including the WebAssembly HEIC fallback.
2. When **Ready to open offline** appears, you can close the tab and later open the same address without a connection in the same browser profile. You can import and export images in the new tab, including your first HEIC photo.

Offline setup needs a secure context (HTTPS or localhost), Service Workers and space in the browser's site storage. Use **Try again** after a failed download or after freeing storage. Clearing site data or browser eviction of the cache means you need to prepare again while online. Photos, metadata and exports stay in the current tab's local processing session. You can use this workflow in a regular browser tab.

Under **Offline**, select **Check for offline updates** to fetch a new build while online. A failed update leaves the most recent complete build available. When **Update saved** appears, close all InkDoze tabs, then reopen InkDoze to use the new build.

Offline reopening and a first HEIC import were tested in Playwright Chromium and Firefox using the WASM fallback, and in Playwright WebKit on macOS using the native decoder. The two-build update and recovery test runs in Playwright Chromium. Offline reopening in Safari and on iPhone remains unverified.

## Features

- **Device catalog.** 367 e-readers from 35 brands, from the 2004 Sony Librie to current Kindle, Kobo, BOOX, PocketBook, reMarkable and Xteink models, with generations kept apart. The list is ordered by approximate popularity. Search by model, generation, alias or resolution (`pw5`, `paperwhite 2021`, `1264x1680`), filter by brand and colour screen, or set a custom size.
- **Honest install guidance.** Screen size and install method are separate. Each method has a status (custom image, book cover only, third-party firmware or app, size confirmed only), a community-documented flag where applicable, steps, limitations and sources with the date they were checked.
- **Framing.** Fit, Fill and Stretch; crop with aspect lock (mouse, touch or keyboard); zoom; offset; 90° rotation; background colour for empty and transparent areas.
- **Tone.** Automatic per-image adjustment for e-ink (levels stretch with a capped gain and a midtone curve, measured on the visible part of the image only). Manual colour or grayscale, brightness and contrast on top of it, invert, 256/16/4/2 gray levels and Floyd–Steinberg or Atkinson dithering.
- **Same pipeline for preview and export.** The preview is rendered at full output resolution by the same code that writes the file. The optional e-ink simulation is labelled as an approximation.
- **Formats.** PNG, JPEG and uncompressed BMP at 24, 8, 4, 2 and 1 bit. The recommended format and file name come from the selected install method.
- **CrossPoint sleep overlay.** Preview transparent images over a test reading page and download `sleep-overlay.png` or a ZIP with a `.sleep-overlay/` folder. Each PNG matches the reader’s screen size.
- **EPUB for Kindle Display Cover.** For ad-free Kindles on stock firmware, which can only show the cover of a book, **Download EPUB for Kindle** packs the selected image, rendered exactly as the image export, into an EPUB 3 book with that image as its cover. One image per book; batches are not packed into EPUBs.
- **HEIC photos.** Still HEIC photos in the layout iPhones write are decoded on the device: by the browser where it can (Safari), otherwise by a WebAssembly build of libheif that ships with InkDoze. See [HEIC photos](#heic-photos).
- **Batches.** Drag and drop or pick several PNG, JPEG, WebP and HEIC files, rename outputs, give single images their own settings, download one file or a ZIP of all. Work runs in a Web Worker with bounded concurrency and can be cancelled.
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
| Xteink | 4 | 2025–2026 | CrossPoint `sleep.bmp`, `sleep-overlay.png` and `.sleep-overlay/`; stock wallpaper |
| Supernote | 4 | 2020–2024 | Custom image (Settings › Display & Input › Screensaver) |
| 24 other brands | 43 | 2006–2025 | Size only (Bigme, Meebook, Likebook, Boyue, Hanlin, Hanvon, iRex, Icarus and others) |

The data lives in [`src/catalog`](src/catalog) as typed records. Every model has a stable ID, brand, model, generation, aliases, portrait resolution, colour flag, sources and a verification date. Sources are tagged as manufacturer, firmware source, community tooling or secondary. Models backed only by secondary sources are marked in the UI. Every ONYX BOOX model sold in Russia, including the archive (Darwin, Faust, Vasco da Gama, Kon-Tiki, Monte Cristo and others), comes from the specification pages of [onyx-boox.ru](https://onyx-boox.ru/), the official distributor. Most other discontinued models are documented on the [MobileRead Wiki](https://wiki.mobileread.com/), maintained by device owners; where firmware-level data exists (CrossPoint, Plato, KOReader) it takes precedence.

The device list is sorted by an approximate popularity score: brand reach, flagship product lines and how recent the model is. There is no public per-model sales data, so the order is an editorial estimate; the weights live in [`src/catalog/popularity.ts`](src/catalog/popularity.ts). Recency is counted from the current year, so the order ages on its own.

Data notes:

- Kindle Paperwhite (12th generation) and Colorsoft render at **1272 × 1696**. Many spec sheets say 1264 × 1680; device screenshots collected by the Kindle Comic Converter project show the larger grid.
- Note Air3 (1404 × 1872) and Note Air3 C (1860 × 2480) share a name but not a resolution, as do Paperwhite generations 5 (1236 × 1648) and 6.
- Current tolino models (2024, built with Kobo) only show the book cover; the "own picture" option belongs to earlier generations.

### Kindle cover EPUB

The EPUB is built in the browser like every other file: InkDoze uploads nothing and never talks to Amazon. To use it:

1. Choose a Kindle model whose install method is the stock-firmware book cover, add an image and select **Download EPUB for Kindle**.
2. Send the EPUB yourself with [Send to Kindle](https://www.amazon.com/sendtokindle). This uploads the file to your Amazon account, where Amazon converts it.
3. Open the book on the Kindle and turn on **Display Cover** (Settings › Screen and brightness on current firmware). Kindles with ads show ads instead of covers.

Limits: the sleep screen follows the last book you opened, so after reading another book you have to open this one again. It is a book cover, not an independent permanent screensaver, and images do not rotate. Copying the EPUB over USB does not work, because stock Kindle firmware does not open EPUB files. Availability of Send to Kindle and Display Cover depends on the model, firmware and region.

The book holds a `mimetype` entry stored first, `META-INF/container.xml`, an EPUB 3 package document whose image item has the `cover-image` property, a navigation document, one XHTML page with the image and the PNG or JPEG cover itself, under fixed paths. The legacy `<meta name="cover">` is added as described in Amazon's [KDP cover guidance](https://kdp.amazon.com/en_US/help/topic/G6GTK3T3NUHKLEFX). The output passes EPUBCheck 5.4.0 without errors or warnings. Display Cover has **not** been verified on a real Kindle yet; reports with model and firmware version are welcome.

### CrossPoint sleep overlay

1. Add your images, choose your reader and select **CrossPoint sleep overlay**.
2. Crop, rotate, scale or position each image against the test reading page. Each exported PNG contains only the overlay at the reader’s screen size, with empty areas kept transparent.
3. Select **Download overlay ZIP** and extract the ZIP to the root of the SD card so the PNGs are directly inside `/.sleep-overlay/`. For a single overlay, select **Download overlay** and copy `sleep-overlay.png` to the root of the card.
4. On CrossPoint 2.0.0, open **Settings › Display › Sleep Screen**. Choose **Transparent** to overlay the current screen or **Cover + Transparent** to overlay the cover of the last opened book.

CrossPoint picks an overlay from the folder at random each time the reader sleeps. To use the folder, move any `sleep-overlay.bmp` or `sleep-overlay.png` out of the SD card root. Both files take priority over the folder, with BMP checked first. [CrossPoint 2.0.0 User Guide](https://github.com/crosspoint-reader/crosspoint-reader/blob/2.0.0/USER_GUIDE.md#transparent-overlay-images)

The browser preview blends the PNG over the test page. On the reader, transparent pixels leave the screen untouched and opaque white pixels cover the content behind them. CrossPoint skips alpha values below 8 (out of 255) and uses a 4 × 4 ordered pattern to decide where to draw partially transparent pixels. Firmware behavior was checked against the 2.0.0 source. Testing on a physical reader is pending. [CrossPoint PNG renderer](https://github.com/crosspoint-reader/crosspoint-reader/blob/2.0.0/lib/Epub/Epub/converters/PngToFramebufferConverter.cpp#L280-L298), [PNG overlay PR](https://github.com/crosspoint-reader/crosspoint-reader/pull/2974)

### CrossPoint and PXC

CrossPoint 2.0.0 ships builds for Xteink X3/X4, X4 Classic, X4 Pro and BOOX Picco. Custom sleep images are `sleep.bmp` in the SD card root or `.bmp` files in `/.sleep`, read as uncompressed BMP (1, 2, 4, 8, 24 or 32 bit, up to 2048 × 3072). InkDoze writes BMP variants that pass a port of CrossPoint's header checks; 24-bit is recommended as in the CrossPoint guide, and 2-bit stores exactly the four native gray levels.

PXC sleep images are only implemented in an [unmerged pull request](https://github.com/crosspoint-reader/crosspoint-reader/pull/1614); released firmware uses the `.pxc` layout only as an internal cache. InkDoze contains a tested PXC encoder for that layout, but does not offer it for any device until a release reads PXC sleep images.

## HEIC photos

Files are recognised by their content, not by name or MIME type, so photos with no extension or an empty type work too. Before anything is decoded, InkDoze reads the HEIF container and checks the file size and the size of the primary image; for tiled (grid) images, as iPhones write them, every tile counts towards the 40 megapixel limit. Damaged containers and images whose size cannot be determined are rejected at that point, and the decoded image is checked again.

- **Supported:** still HEIC images whose primary image is HEVC-coded, either as one image or as a grid of tiles. Rotation and mirroring stored in the container (`irot`, `imir`) are applied once; the EXIF orientation copy is not applied on top.
- **Not supported:** image sequences (HEICS), AVIF, other codecs inside HEIF (JPEG, uncompressed), derived identity and overlay images. Only the primary image is used: depth maps, HDR gain maps, thumbnails and other auxiliary images are ignored. Each case is reported next to the file with its own message.
- **Decoding path.** The worker tests a small built-in HEIC sample with `createImageBitmap` and checks its size and orientation. It uses the browser decoder if the test passes. When the test or a photo decode fails, the worker tries the WebAssembly fallback (libheif 1.23 with libde265). The fallback runs in its own worker, one photo at a time. During a regular online session, the browser requests it on first use (about 2 MB, or 0.7 MB compressed, including the embedded WASM binary). Offline preparation saves those files in advance. The decoder worker stops after a minute without work or when you remove the photo it is decoding, which also returns its memory. [libheif-js](https://github.com/catdad-experiments/libheif-js)
- **Colour:** the WebAssembly path converts to RGB without applying the embedded ICC profile, so Display P3 photos look slightly less saturated than in the browser's own decoder. For grayscale e-ink output the difference is negligible.
- **Output:** the HEIC file and its metadata (EXIF, XMP) are never copied into exported images.

Checked so far: Safari 27.2 on macOS 15.7 (by hand) and Playwright's WebKit build decode HEIC natively; Playwright's Chromium and Firefox builds use the WebAssembly decoder. A real 4000 × 3000 camera photo (48-tile grid) converts in all of them; at original size both paths give the same image with a largest channel difference of 9 of 255, and the same holds for a portrait photo with stored rotation. The automated tests use synthetic photos written by Apple's ImageIO in the iPhone layout (`scripts/make-heic-fixtures.swift`). iOS and original iPhone photos have not been verified yet.

## Browser support

InkDoze needs `OffscreenCanvas`, module Web Workers and `createImageBitmap`, which current versions of Chrome, Edge, Firefox and Safari provide. The automated tests run in Chromium (desktop and Android emulation); HEIC import is also tested in Firefox and WebKit.

Processing profiles use IndexedDB. Saving the versioned record in a transaction keeps simultaneous edits in different tabs from overwriting one another.

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

To try offline reopening with the same path as GitHub Pages, serve the production build at <http://127.0.0.1:4173/inkdoze/>:

```bash
npm run build && npm run preview -- --host 127.0.0.1 --base /inkdoze/
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

Install the Playwright browsers once with `npx playwright install chromium firefox webkit`.

## Hosting

`npm run build` writes a static site to `dist/`. The online app uses relative paths so it can be served from a domain root or a subdirectory. Offline setup registers `/inkdoze/sw.js` with scope `/inkdoze/`.

The repository deploys itself to GitHub Pages with [`.github/workflows/pages.yml`](.github/workflows/pages.yml): after the CI workflow succeeds on `main`, the site is built and published to `https://<owner>.github.io/inkdoze/`. To enable it in a fork, open **Settings › Pages** and set **Source** to **GitHub Actions**; until then the workflow skips deployment with a notice. You can also run it manually from the **Actions** tab.

Vite generates the precache list and SHA-256 digests from the production output, including both workers and the lazy HEIC decoder. The Service Worker prepares a new cache for each build and checks the responses before installation completes. The browser activates an update after the preceding worker has released its last client, so open tabs keep using their own build. On activation the worker claims the preparation tab and removes obsolete InkDoze caches. [Service Worker lifecycle](https://github.com/w3c/ServiceWorker/blob/main/explainer.md#updating-a-service-worker)

### Project layout

```
src/catalog/   devices, install methods, sources, validation
src/pipeline/  geometry, tone and dithering, render job, canvas renderer
src/formats/   BMP, PXC, ZIP and EPUB writers, format registry
src/io/        header and HEIF container probing, limits, file names, task queue
src/offline/   Service Worker and offline preparation
src/worker/    render worker, HEIC decoding and its worker, client
src/i18n/      translator and locale files
src/ui/        Preact components
tests/         unit tests
e2e/           Playwright tests
```

### Tests

Unit tests cover catalog validation (duplicates, incomplete records, wrong orientation, unknown methods or message keys), geometry (crop, rotation, placement, clipping), transparency, tone curves, palettes and dithering, BMP and PXC packing and row alignment checked against independent readers, ZIP structure against zlib's CRC-32, EPUB container layout, metadata and escaping, header probing, HEIF container parsing (HEIC versus AVIF and other ISO BMFF files, grids, damaged boxes), the task queue and locale completeness.

Playwright runs against the production build served from `/inkdoze/`, as on GitHub Pages. It converts real files end to end, decodes the downloads with the browser's own decoders and checks sizes and control pixels, verifies ZIP contents, the Kindle cover EPUB (parsed with the browser's XML parser, cover identical to the image export, cancellation, errors and changes during export), per-file settings, error reporting, cancellation, offline use after load, HEIC import in Chromium, Firefox and WebKit (orientation in the list, preview and export, empty MIME type, mixed batches, damaged files, oversized grids, an unavailable decoder, removal during decoding, which files are loaded and when), and layout in all seven languages at desktop, tablet and phone widths.

The offline tests close the preparation tab before taking the browser offline and checking exports in a fresh tab. They cover first-time HEIC import, applying a saved profile to a new batch, retrying failed downloads, storage quota, cache eviction and recovery across two Vite builds on the same origin.

## Contributing

Corrections to the catalog are the most valuable contribution. See [CONTRIBUTING.md](CONTRIBUTING.md) for what sources a model or install method needs.

## License

[Apache License 2.0](LICENSE)

The HEIC decoder used as a fallback is [libheif-js](https://github.com/catdad-experiments/libheif-js) (libheif and libde265, LGPL-3.0; it also contains the BSD-licensed dav1d). It is built into a separate file that is loaded only when needed and can be replaced. The build includes the license texts under `licenses/`; see [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt).
