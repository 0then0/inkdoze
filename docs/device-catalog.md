# Device catalog

InkDoze's catalog covers hundreds of readers, including recent and discontinued models. Search by name, generation, alias or native resolution. Use **Custom size** when you know the screen dimensions and want to enter them directly. [User guide](user-guide.md)

## What the catalog tells you

The screen size determines the default output dimensions. The **How to install** panel identifies which methods are documented for the selected model, the firmware or app each method applies to and which formats are confirmed. It includes source links and verification dates.

- **Custom image** means the firmware or app can display a user-supplied image.
- **Cover only** means the device shows the current book cover. InkDoze can prepare a cover EPUB for compatible Kindles.
- **Third-party** means the method requires firmware, an app or additional access documented in the guide.
- **Size only** means the catalog confirms the resolution. Installation through stock firmware or an app is undocumented for that entry.

Screen size and installation support are sourced separately for each model or generation. The list order estimates relative popularity using brand, product line and release year. [Catalog data](../src/catalog) · [Ranking weights](../src/catalog/popularity.ts)

### Resolution notes

- Kindle Paperwhite (12th generation) and Kindle Colorsoft (1st generation) use **1272 × 1696** pixels in the catalog, based on device screenshots. [Kindle Comic Converter device evidence](https://github.com/ciromattia/kcc/pull/1299)
- Kindle Paperwhite (11th generation) uses **1236 × 1648**. Search for `pw5` for the 11th generation and `pw6` for the 12th.
- BOOX Note Air3 uses **1404 × 1872** and Note Air3 C uses **1860 × 2480**. Confirm the full model name when selecting a reader.
- For colour e-ink, the catalog records the full monochrome pixel grid. Firmware can render colour at a lower resolution.
- For ONYX BOOX readers sold in Russia, the catalog cites the specification pages of the official distributor. [Regional catalog records](../src/catalog/devices-boox-ru.ts)

## Add or correct an e-reader

### Verify the model and resolution

Identify the brand, model, generation and regional variant. Verify the native portrait resolution in pixels. When sources disagree, prefer evidence closest to the hardware and add a catalog note explaining the difference. Include the source and the date you checked it in the issue or pull request.

Use these source categories in the catalog:

- `manufacturer` covers specifications, datasheets, manuals and official help pages. Use a source that states the pixel grid for resolution claims.
- `firmware` covers stock or open firmware source and panel definitions. Link to a release tag or commit.
- `community` covers projects and device documentation maintained by owners. Prefer measurements, screenshots or framebuffer dumps.
- `secondary` covers retailers, reviews and comparison sites. Use two independent sources when this is the best evidence available. The app labels entries supported only by secondary sources.

### Add the record

Model records live in `devices.ts`, with separate files for the Russian-market ONYX BOOX catalog and for brands with smaller catalogs. Reusable links are in `sources.ts`. Follow the existing `brand()` records and use a unique lowercase ID in kebab case. Keep published IDs stable because saved selections and portable profiles refer to them. Use `ordinal` for numbered generations so the interface can translate them. [Catalog files](../src/catalog)

For example, the Kobo Libra Colour record includes this data:

```ts
{
  id: 'kobo-libra-colour',
  model: 'Libra Colour',
  generation: 'Libra Colour (2024)',
  year: 2024,
  w: 1264,
  h: 1680,
  color: true,
  aliases: ['libra color', 'n428'],
  sources: [koboProduct('kobo-libra-colour', 'Libra Colour')],
  install: ['kobo-cover', 'kobo-screensaver-folder', 'koreader-kobo'],
}
```

Aliases are searchable and must uniquely identify a model. A new brand also needs an entry in `BRANDS` and a reach value in the ranking. The catalog has a shared verification date in `define.ts`. Update it when rechecking the records that inherit it. [Type definitions](../src/catalog/types.ts) · [Ranking](../src/catalog/popularity.ts) · [Catalog record helper](../src/catalog/define.ts)

### Document installation

Add a method only when the cited documentation covers that model or its device line. For a verified resolution without a documented installation method, use `install: []`. Stock firmware and third-party firmware are separate methods. [Installation methods](../src/catalog/install.ts)

- Set `communityDocumented: true` for methods backed solely by community sources.
- List each confirmed format in `formats`. For a custom-image method whose documentation gives no format, leave `formats` empty, set a recommendation and use `limit.formatUnspecified`.
- Add message keys for the method name, steps and limitations. Use `params` for literal device menus, folders and file names. Add corresponding keys to every locale. [Translations](../CONTRIBUTING.md#translations)

Run `npm run catalog:check` to validate the catalog. [Local development checks](development.md#checks-and-tests)
