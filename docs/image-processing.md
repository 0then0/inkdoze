# Image processing

The preview and downloaded image share the same renderer. Use the **Simulate e-ink** control for an approximation of the reader's display. [User guide](user-guide.md)

## Input formats and limits

InkDoze reads PNG, JPEG, WebP and supported still HEIC files. It detects the format from the file contents and checks dimensions before decoding. [File probing](../src/io/probe.ts)

- A batch can contain up to 40 images.
- Each input can be up to 40 MiB and 40 million decoded pixels, with a maximum side length of 16,384 pixels.
- An output can be up to 8,192 pixels per side and 33,554,432 pixels in total.

Firmware can impose stricter limits. See the **How to install** panel for the selected device and method. [App limits](../src/io/limits.ts)

## Output formats

Standard output writes PNG, JPEG or uncompressed BMP (24, 8, 4, 2 or 1 bit). It fills transparent areas with the chosen background and applies the selected tone and colour settings. The 8-, 4-, 2- and 1-bit BMP encoders use grayscale palettes. Batch downloads are ZIP archives. [Renderer](../src/pipeline/render.ts) · [Format registry](../src/formats/registry.ts)

### CrossPoint

For custom sleep images, CrossPoint 2.0.0 reads uncompressed BMP with dimensions up to 2048 × 3072. InkDoze recommends 24-bit BMP for this mode. The 2-bit option stores four gray levels. PXC is the format of CrossPoint's internal pixel cache. [CrossPoint BMP reader](https://github.com/crosspoint-reader/crosspoint-reader/blob/2.0.0/lib/GfxRenderer/Bitmap.cpp) · [CrossPoint sleep implementation](https://github.com/crosspoint-reader/crosspoint-reader/blob/2.0.0/src/activities/boot_sleep/SleepActivity.cpp)

In **CrossPoint sleep overlay** mode, InkDoze writes transparent PNG at the reader's native dimensions. The image keeps its alpha channel and bypasses tone and palette adjustment. The firmware skips alpha values below 8 and uses a 4 × 4 ordered pattern for partial transparency. Transparent pixels leave the screen content visible and opaque white pixels cover it. [Overlay instructions](user-guide.md#crosspoint-sleep-overlay) · [CrossPoint PNG renderer](https://github.com/crosspoint-reader/crosspoint-reader/blob/2.0.0/lib/Epub/Epub/converters/PngToFramebufferConverter.cpp#L280-L298)

### Kindle cover EPUB

The EPUB contains one prepared image, an XHTML page showing it, a navigation document and a package document that marks it with `cover-image`. It uses JPEG when the selected format is JPEG and PNG for other choices. Rendering follows the selected output format's tone and gray levels. Archive paths are fixed and the package also includes the legacy cover metadata described by Amazon. [EPUB writer](../src/formats/epub.ts) · [EPUB 3.3](https://www.w3.org/TR/epub-33/) · [Amazon cover guidance](https://kdp.amazon.com/en_US/help/topic/G6GTK3T3NUHKLEFX)

## HEIC photos

HEIC support covers still HEVC images, including the tiled grid layout written by iPhones. InkDoze uses the primary image and its alpha plane. HEIC sequences, AVIF and HEIF images with other codecs are unsupported. Depth maps, HDR gain maps and thumbnails are ignored.

The HEIF container is checked before decoding, including the total decoded pixels across all grid tiles. The app checks the decoded dimensions again and applies container rotation and mirroring once. [HEIF probing](../src/io/heif.ts)

The render worker tests whether the browser can decode an oriented HEIC sample. If that test or a native decode fails, it uses a separate WebAssembly worker built on libheif and libde265. An online session loads the fallback on first use. Offline preparation caches it with the app. [HEIC decoder](../src/worker/heic.ts) · [Third-party notices](../THIRD_PARTY_NOTICES.txt)

### Display P3 colour

The native path uses browser colour management. The WebAssembly fallback converts an 8-bit SDR image when the primary image has the recognised Apple Display P3 ICC profile. For a grid, that profile must be on the primary grid item. The tiles may carry the same profile or omit it. [Display P3 profile](https://registry.color.org/rgb-registry/displayp3)

The fallback uses libheif to decode RGB. A companion `nclx` colour property can supply decoding parameters such as the YCbCr matrix and range. The Display P3 transform accepts SDR or unspecified transfer codes `1`, `2`, `6` and `13`. Other colour profiles and higher bit depths use libheif's decoded values. [HEIF colour checks](../src/io/heif.ts) · [libheif decode path](https://github.com/strukturag/libheif/blob/v1.23.5/libheif/image-items/image_item.cc#L1364-L1438)

The conversion undoes premultiplication when the source indicates it, preserves alpha and clips linear sRGB components to the output gamut. Preview and export then use the same sRGB pixels for further rendering. Exports omit source metadata such as EXIF, XMP and the original ICC profile. [Colour conversion code](../src/worker/display-p3.ts) · [CSS Color 4 conversion reference](https://www.w3.org/TR/2026/CRD-css-color-4-20261123/#color-conversion-code)

The browser tests compare swatch centres in the preview and downloaded PNG against an independent Little CMS reference. The fixtures cover single images, rotated grids, and straight and premultiplied alpha. The fixture generator runs on macOS with Apple's ImageIO. [HEIC browser tests](../e2e/heic.spec.ts) · [Fixture generator](../scripts/make-heic-fixtures.swift)
