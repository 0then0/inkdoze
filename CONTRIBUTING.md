# Contributing to InkDoze

Thanks for helping. Bug reports, catalog corrections, translations and code are all welcome. By participating you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Setup

```bash
npm ci
```

```bash
npm run dev
```

Before opening a pull request, run:

```bash
npm run check
```

```bash
npm run test:e2e
```

## Adding or correcting an e-reader

Device data lives in [`src/catalog/devices.ts`](src/catalog/devices.ts), install methods in [`src/catalog/install.ts`](src/catalog/install.ts) and reusable source links in [`src/catalog/sources.ts`](src/catalog/sources.ts). `npm run catalog:check` validates both and runs in CI.

### 1. Check the resolution

The resolution is the native panel grid in **portrait** orientation (width < height). A matching diagonal, ppi or marketing name does not prove a matching resolution: check every generation and regional variant on its own.

Acceptable sources, best first:

| Kind | Examples | Notes |
| --- | --- | --- |
| `manufacturer` | Spec page, datasheet, manual, help center | Must state the pixel grid. A page that only gives ppi is `secondary` for the resolution. |
| `firmware` | Stock or open firmware source, SDK panel definitions | Link to a tag or commit, not a moving branch. |
| `community` | KOReader, Kindle Comic Converter, other tools whose values come from real devices | Prefer data backed by device screenshots or framebuffer dumps. |
| `secondary` | Retailers, reviews, comparison sites | Allowed only when nothing better exists; the UI shows a warning. Use two independent sources. |

For colour panels (Kaleido, Gallery), record the full black-and-white grid. If sources disagree, use the one closest to the hardware and add a `note` explaining the difference (see `note.kindle.marketingResolution`).

### 2. Add the record

```ts
{
  id: 'kobo-libra-colour',      // stable, lowercase kebab-case, never renamed
  model: 'Libra Colour',
  generation: 'Libra Colour (2024)', // or 'Nth generation (YYYY)' with `ordinal`
  ordinal: undefined,           // set for numbered generations; the UI translates it
  year: 2024,
  w: 1264,
  h: 1680,
  color: true,
  aliases: ['libra color', 'n428'], // model numbers, codenames, common short names
  sources: [koboProduct('kobo-libra-colour', 'Libra Colour')],
  install: ['kobo-cover', 'kobo-screensaver-folder', 'koreader-kobo'],
}
```

- IDs and aliases must be unique across the catalog.
- `generation` must not contain English words other than names; numbered generations use `ordinal` so every language can render them.
- `verified` is set by the brand helper; update `VERIFIED` in the file when you recheck a group of records.

### 3. Link an install method

An install method describes how a specific firmware or app shows a custom image. Sharing a screen size does **not** mean sharing a method, so add a method to a device only when a source covers that model or its whole line.

Statuses:

- `custom-image`: the firmware or app can show a user-supplied image.
- `cover-only`: only the current book cover can be shown.
- `third-party`: needs a specific third-party firmware, jailbreak, root/SSH access or app.
- `size-only`: no documented method. Use this by leaving `install: []`.

Set `communityDocumented: true` when the only sources are community guides, forums or blogs rather than the vendor or the firmware project.

A method needs:

- `sources` that state the menu path, folder or file name, and formats. Prefer official docs or firmware source code; for firmware, link a release tag.
- `formats`: only formats a source confirms. Leave it empty when the vendor does not specify any, and set `recommendedFormat` (usually `png`) together with the `limit.formatUnspecified` limitation.
- `steps` and `limitations` as message keys. Menu labels, paths and file names go in `params` so they are shown verbatim and never translated.
- A `method.<id>` message key with the localized method name.

For CrossPoint, check the BMP reader (`lib/GfxRenderer/Bitmap.cpp`) and the sleep screen code (`src/activities/boot_sleep/SleepActivity.cpp`) at the release tag, not only the user guide. Stock firmware and CrossPoint are separate methods even on the same device. PXC stays hidden until a CrossPoint release reads PXC sleep images.

### 4. Add translations

Every new message key must exist in all files in [`src/i18n/locales`](src/i18n/locales). The type checker rejects missing keys, and unit tests check placeholders and plural forms. Keep placeholders such as `{menu}` unchanged.

## Translations

Translations should read like native UI text, not word-for-word English. Keep product and brand names in Latin script. After editing, run `npm run test:e2e`: the locale tests fail if any text is clipped or overflows at desktop, tablet or phone width.

## Code

- TypeScript with `strict` settings, Preact for the UI, no runtime dependencies beyond Preact.
- Type checking uses TypeScript 7 (the native compiler), installed as `@typescript/native`. `typescript` stays on 6.x only because typescript-eslint still needs the JavaScript compiler API, which TypeScript 7 does not ship. Run `npm run typecheck` rather than a bare `tsc`: both packages provide a `tsc` binary.
- The app must work offline after load and must not make network requests. ESLint forbids `fetch`, `XMLHttpRequest`, `WebSocket` and `EventSource` in app code.
- Binary formats need tests that read the output with an independent decoder.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).
