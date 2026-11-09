# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Browser-only converter for e-reader sleep screens: drag and drop or file picker for PNG, JPEG and WebP; per-file errors; limits on file count, file size and decoded pixels.
- Catalog of 113 e-readers across Kindle, Kobo, BOOX, PocketBook, Xteink, tolino, NOOK, Bigme, Meebook, Supernote, reMarkable, DuRoBo and Viwoods, with search, brand and colour filters, custom size and sourced install methods.
- Fit, Fill and Stretch framing, aspect-locked crop, zoom, offset, rotation and background colour.
- Grayscale or colour, brightness, contrast, invert, 256/16/4/2 gray levels with Floyd–Steinberg or Atkinson dithering.
- PNG, JPEG and BMP (24, 8, 4, 2, 1 bit) export; ZIP download for batches; editable file names; per-file settings.
- PXC encoder for CrossPoint's 2-bit layout, not exposed until a CrossPoint release reads PXC sleep images.
- English, Russian, Spanish, German, French, Japanese and Brazilian Portuguese interface.
- Type checking with TypeScript 7.0; TypeScript 6.0 is kept for typescript-eslint.
- CI with catalog validation, type checks, lint, unit tests, production build and Playwright tests.
- GitHub Pages deployment after CI passes on `main`.
