import { crc32 as nodeCrc32 } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { EPUB_MIME, cleanTitle, createCoverEpub, epubDate, epubImageFormat, escapeXml, type EpubCoverInput } from '../src/formats/epub.ts';

interface Entry {
  name: string;
  method: number;
  localExtra: number;
  centralExtra: number;
  localOffset: number;
  data: Uint8Array;
}

const concat = (parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

/** Reads the archive from the end-of-central-directory record, independently of the writer. */
function readZip(bytes: Uint8Array): Entry[] {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = bytes.length - 22;
  expect(v.getUint32(eocd, true)).toBe(0x06054b50);
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const dec = new TextDecoder('utf-8', { fatal: true });
  const out: Entry[] = [];
  for (let i = 0; i < count; i++) {
    expect(v.getUint32(p, true)).toBe(0x02014b50);
    const method = v.getUint16(p + 10, true);
    const crc = v.getUint32(p + 16, true);
    const compressed = v.getUint32(p + 20, true);
    const size = v.getUint32(p + 24, true);
    const nameLen = v.getUint16(p + 28, true);
    const centralExtra = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    expect(v.getUint32(local, true)).toBe(0x04034b50);
    expect(v.getUint16(local + 8, true), `local method of ${name}`).toBe(method);
    const localExtra = v.getUint16(local + 28, true);
    const start = local + 30 + v.getUint16(local + 26, true) + localExtra;
    expect(compressed).toBe(size);
    const data = bytes.subarray(start, start + size);
    expect(nodeCrc32(data), `crc of ${name}`).toBe(crc);
    out.push({ name, method, localExtra, centralExtra, localOffset: local, data });
    p += 46 + nameLen + centralExtra + commentLen;
  }
  return out;
}

const text = (e: Entry | undefined) => new TextDecoder('utf-8', { fatal: true }).decode(e?.data);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5]);

function build(patch: Partial<EpubCoverInput> = {}) {
  const input: EpubCoverInput = {
    title: 'Sleep screen',
    language: 'en',
    identifier: 'urn:uuid:00000000-0000-4000-8000-000000000000',
    modified: new Date(Date.UTC(2026, 10, 14, 9, 30, 15, 250)),
    image: { data: PNG, format: 'png' },
    ...patch,
  };
  const bytes = concat(createCoverEpub(input));
  const entries = readZip(bytes);
  const get = (name: string) => entries.find((e) => e.name === name);
  return { bytes, entries, get, opf: text(get('EPUB/package.opf')), nav: text(get('EPUB/nav.xhtml')), page: text(get('EPUB/cover.xhtml')) };
}

describe('EPUB container', () => {
  it('starts with a stored mimetype entry without extra fields', () => {
    const { bytes, entries } = build();
    const first = entries[0]!;
    expect(first.name).toBe('mimetype');
    expect(first.localOffset).toBe(0);
    expect(first.method).toBe(0);
    expect(first.localExtra).toBe(0);
    expect(first.centralExtra).toBe(0);
    expect(text(first)).toBe(EPUB_MIME);
    // The classic magic check: "mimetype" + content at fixed offsets 30 and 38.
    expect(new TextDecoder().decode(bytes.subarray(30, 38 + EPUB_MIME.length))).toBe(`mimetype${EPUB_MIME}`);
  });

  it('has fixed paths and nothing else', () => {
    const { entries } = build({ title: '../../evil/<x>.png' });
    expect(entries.map((e) => e.name)).toEqual([
      'mimetype',
      'META-INF/container.xml',
      'EPUB/package.opf',
      'EPUB/nav.xhtml',
      'EPUB/cover.xhtml',
      'EPUB/images/cover.png',
    ]);
  });

  it('points the container to the package document', () => {
    const { get } = build();
    expect(text(get('META-INF/container.xml'))).toMatch(
      /<rootfile full-path="EPUB\/package\.opf" media-type="application\/oebps-package\+xml"\/>/,
    );
  });

  it('stores the image bytes unchanged', () => {
    const { get } = build();
    expect([...get('EPUB/images/cover.png')!.data]).toEqual([...PNG]);
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 9, 9, 0xff, 0xd9]);
    const j = build({ image: { data: jpeg, format: 'jpeg' } });
    expect([...j.get('EPUB/images/cover.jpg')!.data]).toEqual([...jpeg]);
    expect(j.opf).toContain('href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"');
  });
});

describe('EPUB package', () => {
  it('declares required metadata, cover, nav and spine', () => {
    const { opf } = build();
    expect(opf).toContain('version="3.0" unique-identifier="book-id"');
    expect(opf).toContain('<dc:identifier id="book-id">urn:uuid:00000000-0000-4000-8000-000000000000</dc:identifier>');
    expect(opf).toContain('<dc:language>en</dc:language>');
    expect(opf).toContain('<meta property="dcterms:modified">2026-11-14T09:30:15Z</meta>');
    expect(opf).toContain('<meta name="cover" content="cover-image"/>');
    expect(opf.match(/properties="cover-image"/g)).toHaveLength(1);
    expect(opf.match(/properties="nav"/g)).toHaveLength(1);
    expect(opf).toMatch(/<item id="cover-image" href="images\/cover\.png" media-type="image\/png" properties="cover-image"\/>/);
    expect(opf).toMatch(/<spine>\s*<itemref idref="cover-page"\/>\s*<\/spine>/);
  });

  it('links every manifest item to an existing entry', () => {
    const { opf, get } = build();
    const hrefs = [...opf.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!);
    expect(hrefs).toHaveLength(3);
    for (const href of hrefs) expect(get(`EPUB/${href}`), href).toBeDefined();
  });

  it('has a toc nav and a page showing the cover image, without scripts or external resources', () => {
    const { nav, page } = build();
    expect(nav).toContain('<nav epub:type="toc" id="toc">');
    expect(nav).toContain('<a href="cover.xhtml">');
    expect(nav).toContain('<a epub:type="cover" href="cover.xhtml">');
    expect(page).toContain('<img src="images/cover.png" alt="Sleep screen"/>');
    for (const doc of [nav, page]) {
      expect(doc).not.toMatch(/<script|<link|https?:\/\/(?!www\.w3\.org\/1999\/xhtml|www\.idpf\.org\/2007\/ops)/);
    }
  });
});

describe('EPUB text', () => {
  const tricky = 'Сон & «тишина» 夢の\'画面\' "quoted" <b>bold</b>';

  it('escapes titles in every document', () => {
    const { opf, nav, page } = build({ title: tricky });
    const escaped = 'Сон &amp; «тишина» 夢の&apos;画面&apos; &quot;quoted&quot; &lt;b&gt;bold&lt;/b&gt;';
    expect(opf).toContain(`<dc:title>${escaped}</dc:title>`);
    expect(nav).toContain(`<title>${escaped}</title>`);
    expect(page).toContain(`alt="${escaped}"`);
    for (const doc of [opf, nav, page]) expect(doc).not.toContain('<b>');
  });

  it('escapes all XML special characters', () => {
    expect(escapeXml(`<a href="x">&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&apos;&lt;/a&gt;');
  });

  it('cleans titles: control characters, whitespace, length and empty input', () => {
    expect(cleanTitle('  a\u0000b\u0007\n\tc  ')).toBe('a b c');
    expect(cleanTitle('\u0001 \u0002')).toBe('InkDoze');
    const long = '夢'.repeat(500);
    expect(cleanTitle(long)).toBe('夢'.repeat(200));
    // Truncation never splits a surrogate pair.
    expect(cleanTitle('😀'.repeat(300))).toBe('😀'.repeat(200));
  });

  it('writes UTC dates without milliseconds', () => {
    expect(epubDate(new Date(Date.UTC(2026, 0, 2, 3, 4, 5, 999)))).toBe('2026-01-02T03:04:05Z');
  });

  it('stores the cover as PNG unless the chosen format is JPEG', () => {
    expect(epubImageFormat('jpeg')).toBe('jpeg');
    for (const f of ['png', 'bmp24', 'bmp1', 'pxc']) expect(epubImageFormat(f)).toBe('png');
  });
});
