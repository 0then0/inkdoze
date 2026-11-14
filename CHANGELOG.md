# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-11-14

### Added

- Browser-only converter for e-reader sleep screens: drag and drop or file picker for PNG, JPEG and WebP; per-file errors; limits on file count, file size and decoded pixels.
- Catalog of 367 e-readers from 35 brands, including every ONYX BOOX model listed on onyx-boox.ru and discontinued models back to 2004, with search, brand and colour filters, custom size and sourced install methods. The device list is ordered by approximate popularity.
- Screen Saver Hack install method for Kindles with firmware 2.x–4.x.
- Fit, Fill and Stretch framing, aspect-locked crop, zoom, offset, rotation and background colour.
- Automatic e-ink adjustment, on by default: per-image contrast stretch and midtone curve, colour or grayscale chosen from the e-reader, manual settings folded away. The last selected e-reader is remembered.
- Grayscale or colour, brightness, contrast, invert, 256/16/4/2 gray levels with Floyd–Steinberg or Atkinson dithering.
- PNG, JPEG and BMP (24, 8, 4, 2, 1 bit) export; ZIP download for batches; editable file names; per-file settings.
- EPUB export for Kindle Display Cover: the selected image, rendered as in the image export, becomes the cover of an EPUB 3 book built in the browser, to be sent manually with Send to Kindle. The sleep screen follows the last opened book; not yet verified on a real Kindle.
- PXC encoder for CrossPoint's 2-bit layout, not exposed until a CrossPoint release reads PXC sleep images.
- English, Russian, Spanish, German, French, Japanese and Brazilian Portuguese interface.
- Type checking with TypeScript 7.0; TypeScript 6.0 is kept for typescript-eslint.
- CI with catalog validation, type checks, lint, unit tests, production build and Playwright tests.
- GitHub Pages deployment after CI passes on `main`.

[Unreleased]: https://github.com/0then0/inkdoze/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/0then0/inkdoze/releases/tag/v0.1.0
