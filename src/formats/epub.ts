/**
 * EPUB 3 container for one prepared image used as the book cover.
 *
 * Structure follows EPUB 3.3 (https://www.w3.org/TR/epub-33/): an uncompressed `mimetype`
 * first, `META-INF/container.xml`, a package document with the image marked by the
 * `cover-image` manifest property, a navigation document and one XHTML page showing the
 * image. The legacy `<meta name="cover">` is added because Amazon's KDP guidelines name it
 * as a way to declare the cover; EPUB 3.3 allows OPF2 `meta` elements as legacy metadata.
 *
 * Archive paths are fixed and never derived from the source file name.
 */
import { createZip, type ZipEntry } from './zip.ts';

export type EpubImageFormat = 'png' | 'jpeg';

export interface EpubCoverInput {
  /** Book title as typed by the user. Escaped here; control characters are removed. */
  title: string;
  /** BCP 47 language tag of the book. */
  language: string;
  /** Unique identifier, e.g. `urn:uuid:…`. */
  identifier: string;
  modified: Date;
  image: { data: Uint8Array; format: EpubImageFormat };
}

export const EPUB_MIME = 'application/epub+zip';
export const EPUB_PATHS = {
  mimetype: 'mimetype',
  container: 'META-INF/container.xml',
  package: 'EPUB/package.opf',
  nav: 'EPUB/nav.xhtml',
  page: 'EPUB/cover.xhtml',
  png: 'EPUB/images/cover.png',
  jpeg: 'EPUB/images/cover.jpg',
} as const;

const IMAGE_MIME: Record<EpubImageFormat, string> = { png: 'image/png', jpeg: 'image/jpeg' };
const MAX_TITLE = 200;

/** EPUB stores the image as PNG or JPEG; any other output format falls back to PNG. */
export function epubImageFormat(format: string): EpubImageFormat {
  return format === 'jpeg' ? 'jpeg' : 'png';
}

/** Escape text for XML element content and double-quoted attribute values. */
export function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/**
 * Remove control characters XML 1.0 does not allow, collapse whitespace and cap the length.
 * Lone surrogates need no handling: TextEncoder writes them as U+FFFD, which XML allows.
 */
export function cleanTitle(title: string, fallback = 'InkDoze'): string {
  const cleaned = [
    ...title
      .normalize('NFC')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f-\u009f\ufffe\uffff]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  ]
    .slice(0, MAX_TITLE)
    .join('')
    .trim();
  return cleaned || fallback;
}

/** `YYYY-MM-DDThh:mm:ssZ` in UTC, as EPUB 3.3 requires for `dcterms:modified`. */
export function epubDate(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function containerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="${EPUB_PATHS.package}" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`;
}

function packageOpf(input: EpubCoverInput, title: string, imageHref: string): string {
  const lang = escapeXml(input.language);
  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="${lang}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${escapeXml(input.identifier)}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:language>${lang}</dc:language>
    <meta property="dcterms:modified">${epubDate(input.modified)}</meta>
    <meta name="cover" content="cover-image"/>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="cover-page" href="cover.xhtml" media-type="application/xhtml+xml"/>
    <item id="cover-image" href="${imageHref}" media-type="${IMAGE_MIME[input.image.format]}" properties="cover-image"/>
  </manifest>
  <spine>
    <itemref idref="cover-page"/>
  </spine>
</package>
`;
}

function navXhtml(input: EpubCoverInput, title: string): string {
  const lang = escapeXml(input.language);
  const t = escapeXml(title);
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}">
<head>
  <meta charset="UTF-8"/>
  <title>${t}</title>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>${t}</h1>
    <ol>
      <li><a href="cover.xhtml">${t}</a></li>
    </ol>
  </nav>
  <nav epub:type="landmarks" id="landmarks" hidden="">
    <ol>
      <li><a epub:type="cover" href="cover.xhtml">${t}</a></li>
    </ol>
  </nav>
</body>
</html>
`;
}

function coverXhtml(input: EpubCoverInput, title: string, imageHref: string): string {
  const lang = escapeXml(input.language);
  const t = escapeXml(title);
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}">
<head>
  <meta charset="UTF-8"/>
  <title>${t}</title>
  <style>
    html, body { margin: 0; padding: 0; height: 100%; }
    body { text-align: center; }
    img { max-width: 100%; max-height: 100%; }
  </style>
</head>
<body>
  <section epub:type="cover">
    <img src="${imageHref}" alt="${t}"/>
  </section>
</body>
</html>
`;
}

/**
 * Build the EPUB as ZIP chunks (pass them to `new Blob()`). The image bytes are stored
 * unchanged, so the cover is exactly the file the render pipeline produced.
 */
export function createCoverEpub(input: EpubCoverInput): Uint8Array[] {
  const title = cleanTitle(input.title);
  const imagePath = EPUB_PATHS[input.image.format];
  const imageHref = imagePath.slice('EPUB/'.length);
  const enc = new TextEncoder();
  const date = input.modified;
  const entries: ZipEntry[] = [
    // Must be first, stored and without extra fields; createZip stores every entry and writes none.
    { name: EPUB_PATHS.mimetype, data: enc.encode(EPUB_MIME), date },
    { name: EPUB_PATHS.container, data: enc.encode(containerXml()), date },
    { name: EPUB_PATHS.package, data: enc.encode(packageOpf(input, title, imageHref)), date },
    { name: EPUB_PATHS.nav, data: enc.encode(navXhtml(input, title)), date },
    { name: EPUB_PATHS.page, data: enc.encode(coverXhtml(input, title, imageHref)), date },
    { name: imagePath, data: input.image.data, date },
  ];
  return createZip(entries);
}
