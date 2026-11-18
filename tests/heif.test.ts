import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { familyFromBrands } from '../src/io/heif.ts';
import { LIMITS, overInputLimits } from '../src/io/limits.ts';
import { probeBlob } from '../src/io/probe.ts';

// ---------------------------------------------------------------- ISO BMFF builder

const cat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};
const u8 = (...v: number[]) => new Uint8Array(v);
const u16 = (v: number) => u8(v >> 8, v & 255);
const u32 = (v: number) => u8(v >>> 24, (v >> 16) & 255, (v >> 8) & 255, v & 255);
const cc = (s: string) => new TextEncoder().encode(s);
const box = (type: string, ...parts: Uint8Array[]) => {
  const body = cat(...parts);
  return cat(u32(8 + body.length), cc(type), body);
};
const full = (type: string, version: number, flags: number, ...parts: Uint8Array[]) =>
  box(type, u8(version, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255), ...parts);

const ftyp = (...brands: string[]) => box('ftyp', cc(brands[0]!), u32(0), ...brands.map(cc));
const ispe = (w: number, h: number) => full('ispe', 0, 0, u32(w), u32(h));
const hvcC = () => box('hvcC', new Uint8Array(23));
const irot = (angle: number) => box('irot', u8(angle));

interface Item {
  id: number;
  type: string;
  /** Indexes into `properties`, 1-based. */
  props: number[];
  /** iloc: [construction method, offset, length]. */
  loc?: [number, number, number];
}

function heif(opts: {
  brands?: string[];
  primary: number;
  items: Item[];
  properties: Uint8Array[];
  dimg?: Array<[number, number[]]>;
  idat?: Uint8Array;
  tail?: Uint8Array;
}): Uint8Array<ArrayBuffer> {
  const infe = opts.items.map((i) => full('infe', 2, 0, u16(i.id), u16(0), cc(i.type)));
  const located = opts.items.filter((i) => i.loc);
  // iloc version 1: offset_size 4, length_size 4, base_offset_size 0, index_size 0.
  const iloc = full(
    'iloc',
    1,
    0,
    u8(0x44, 0x00),
    u16(located.length),
    ...located.map((i) => cat(u16(i.id), u16(i.loc![0]), u16(0), u16(1), u32(i.loc![1]), u32(i.loc![2]))),
  );
  const ipma = full(
    'ipma',
    0,
    0,
    u32(opts.items.length),
    ...opts.items.map((i) => cat(u16(i.id), u8(i.props.length), ...i.props.map((p) => u8(p)))),
  );
  const iref = opts.dimg?.length
    ? full('iref', 0, 0, ...opts.dimg.map(([from, to]) => box('dimg', u16(from), u16(to.length), ...to.map(u16))))
    : new Uint8Array(0);
  const meta = full(
    'meta',
    0,
    0,
    full('hdlr', 0, 0, u32(0), cc('pict'), new Uint8Array(13)),
    full('pitm', 0, 0, u16(opts.primary)),
    full('iinf', 0, 0, u16(infe.length), ...infe),
    iref,
    box('iprp', box('ipco', ...opts.properties), ipma),
    opts.idat ? box('idat', opts.idat) : new Uint8Array(0),
    iloc,
  );
  return cat(ftyp(...(opts.brands ?? ['heic', 'mif1', 'heic'])), meta, opts.tail ?? box('mdat', new Uint8Array(64)));
}

/** Single HEVC image: properties 1 hvcC, 2 ispe, 3 irot. */
const single = (w: number, h: number, angle = 0, type = 'hvc1') =>
  heif({
    primary: 1,
    items: [{ id: 1, type, props: angle ? [1, 2, 3] : [1, 2], loc: [0, 0, 16] }],
    properties: [hvcC(), ispe(w, h), irot(angle)],
  });

/** Grid of HEVC tiles described in `idat`: properties 1 hvcC, 2 tile ispe, 3 grid ispe, 4 irot. */
function grid(o: { rows: number; cols: number; tile: number; width: number; height: number; tiles?: number; tileType?: string; method?: number }) {
  const count = o.tiles ?? o.rows * o.cols;
  const ids = Array.from({ length: count }, (_, i) => i + 1);
  const desc = cat(u8(0, 0, o.rows - 1, o.cols - 1), u16(o.width), u16(o.height));
  return heif({
    primary: 1000,
    items: [
      ...ids.map((id) => ({ id, type: o.tileType ?? 'hvc1', props: [1, 2], loc: [0, 0, 16] as [number, number, number] })),
      { id: 1000, type: 'grid', props: [3, 4], loc: [o.method ?? 1, 0, desc.length] },
    ],
    properties: [hvcC(), ispe(o.tile, o.tile), ispe(o.width, o.height), irot(1)],
    dimg: [[1000, ids]],
    idat: desc,
  });
}

const blob = (bytes: Uint8Array<ArrayBuffer>, type = '') => new Blob([bytes], { type });

describe('HEIC container probe', () => {
  it('reads the size of a single HEVC image and applies irot', async () => {
    expect(await probeBlob(blob(single(4032, 3024)))).toMatchObject({ kind: 'heic', width: 4032, height: 3024 });
    expect(await probeBlob(blob(single(4032, 3024, 1)))).toMatchObject({
      kind: 'heic',
      width: 3024,
      height: 4032,
      heic: { rotation: 1, tiles: 1, decodePixels: 4032 * 3024 },
    });
  });

  it('takes a grid size from the grid descriptor and counts every tile for the decode budget', async () => {
    const r = await probeBlob(blob(grid({ rows: 6, cols: 8, tile: 512, width: 4032, height: 3024 })));
    expect(r).toMatchObject({ kind: 'heic', width: 3024, height: 4032, heic: { tiles: 48, decodePixels: 48 * 512 * 512 } });
  });

  it('rejects a large composite image before decoding, by output size or by tile area', async () => {
    // 48 MP: 8064×6048 from 8×6 tiles of 1024².
    const big = await probeBlob(blob(grid({ rows: 6, cols: 8, tile: 1024, width: 8064, height: 6048 })));
    if (typeof big === 'string') throw new Error(big);
    expect([big.width, big.height]).toEqual([6048, 8064]);
    expect(overInputLimits(big.width, big.height, big.heic?.decodePixels)).toBe(true);
    // A small output canvas built from one huge tile still decodes the whole tile.
    const tile = await probeBlob(blob(grid({ rows: 1, cols: 1, tile: 16000, width: 100, height: 100 })));
    if (typeof tile === 'string') throw new Error(tile);
    expect([tile.width, tile.height]).toEqual([100, 100]);
    expect(tile.heic?.decodePixels).toBe(16000 * 16000);
    expect(overInputLimits(tile.width, tile.height, tile.heic?.decodePixels)).toBe(true);
    // Within limits.
    const ok = await probeBlob(blob(grid({ rows: 6, cols: 8, tile: 512, width: 4032, height: 3024 })));
    if (typeof ok === 'string') throw new Error(ok);
    expect(overInputLimits(ok.width, ok.height, ok.heic?.decodePixels)).toBe(false);
    expect(LIMITS.maxInputPixels).toBeLessThan(6048 * 8064);
  });

  it('reads a grid descriptor stored in mdat', async () => {
    const desc = cat(u8(0, 0, 0, 1), u16(1000), u16(500));
    const build = (offset: number) =>
      heif({
        primary: 10,
        items: [
          { id: 1, type: 'hvc1', props: [1, 2], loc: [0, 0, 16] },
          { id: 2, type: 'hvc1', props: [1, 2], loc: [0, 0, 16] },
          { id: 10, type: 'grid', props: [3], loc: [0, offset, desc.length] },
        ],
        properties: [hvcC(), ispe(512, 512), ispe(1000, 500)],
        dimg: [[10, [1, 2]]],
        tail: box('mdat', desc),
      });
    // The descriptor is the payload of the mdat box at the end of the file; offsets have a fixed width.
    const length = build(0).length;
    const file = build(length - desc.length);
    expect(await probeBlob(blob(file))).toMatchObject({ kind: 'heic', width: 1000, height: 500, heic: { tiles: 2 } });
  });

  it('tells HEIC apart from AVIF and other ISO BMFF files', async () => {
    expect(await probeBlob(blob(single(800, 600, 0, 'av01')))).toBe('unsupported');
    expect(await probeBlob(blob(grid({ rows: 1, cols: 2, tile: 512, width: 1000, height: 500, tileType: 'av01' })))).toBe('unsupported');
    // MP4 video and an AVIF sequence without a still image.
    expect(await probeBlob(blob(cat(ftyp('isom', 'iso2', 'mp41'), box('moov', new Uint8Array(32)))))).toBe('unsupported');
    expect(await probeBlob(blob(cat(ftyp('avis', 'msf1', 'avif'), box('moov', new Uint8Array(32)))))).toBe('unsupported');
    expect(familyFromBrands(['avif', 'mif1'])).toBe('avif');
    expect(familyFromBrands(['heic', 'mif1'])).toBe('heic');
    expect(familyFromBrands(['mif1'])).toBe('heif');
    expect(familyFromBrands(['qt  '])).toBe('other');
  });

  it('reports sequences and other HEIF codings as unsupported variants', async () => {
    expect(await probeBlob(blob(cat(ftyp('msf1', 'hevc', 'msf1'), box('moov', new Uint8Array(32)))))).toBe('heicVariant');
    expect(await probeBlob(blob(single(800, 600, 0, 'jpeg')))).toBe('heicVariant');
    expect(await probeBlob(blob(single(800, 600, 0, 'iden')))).toBe('heicVariant');
    expect(await probeBlob(blob(grid({ rows: 6, cols: 8, tile: 512, width: 4032, height: 3024, method: 2 })))).toBe('heicVariant');
  });

  it('rejects damaged containers and unknown sizes as corrupt', async () => {
    const good = single(4032, 3024);
    // Cut inside the meta box and inside the mdat box.
    expect(await probeBlob(blob(good.subarray(0, 120)))).toBe('corrupt');
    expect(await probeBlob(blob(good.subarray(0, good.length - 10)))).toBe('corrupt');
    // No ispe: the size cannot be known before decoding.
    expect(
      await probeBlob(blob(heif({ primary: 1, items: [{ id: 1, type: 'hvc1', props: [1], loc: [0, 0, 16] }], properties: [hvcC()] }))),
    ).toBe('corrupt');
    // Primary item that does not exist, and a property index past ipco.
    expect(await probeBlob(blob(heif({ primary: 7, items: [{ id: 1, type: 'hvc1', props: [1, 2], loc: [0, 0, 16] }], properties: [hvcC(), ispe(10, 10)] })))).toBe('corrupt');
    expect(await probeBlob(blob(heif({ primary: 1, items: [{ id: 1, type: 'hvc1', props: [1, 9], loc: [0, 0, 16] }], properties: [hvcC(), ispe(10, 10)] })))).toBe('corrupt');
    // Grid with a missing tile, and tiles that do not cover the output.
    expect(await probeBlob(blob(grid({ rows: 6, cols: 8, tile: 512, width: 4032, height: 3024, tiles: 47 })))).toBe('corrupt');
    expect(await probeBlob(blob(grid({ rows: 6, cols: 8, tile: 256, width: 4032, height: 3024 })))).toBe('corrupt');
    // A box whose size runs past the end of the file.
    const bad = good.slice();
    bad.set(u32(0x7fffffff), ftyp('heic', 'mif1', 'heic').length);
    expect(await probeBlob(blob(bad))).toBe('corrupt');
    // An ftyp box followed by garbage.
    expect(await probeBlob(blob(cat(ftyp('heic', 'mif1'), u8(0, 0, 0, 3, 1, 2, 3))))).toBe('corrupt');
  });

  describe('fixtures written by Apple ImageIO', () => {
    const fixture = (name: string) => new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));

    it('reads the iPhone layout: 48 tiles of 512², stored landscape with irot', async () => {
      expect(await probeBlob(blob(fixture('portrait-iphone-layout.heic')))).toEqual({
        kind: 'heic',
        width: 3024,
        height: 4032,
        heic: { decodePixels: 48 * 512 * 512, rotation: 3, mirror: false, tiles: 48 },
      });
    });

    it('does not depend on the file name or MIME type', async () => {
      const bytes = fixture('portrait-small.heic');
      const expected = { kind: 'heic', width: 600, height: 800 };
      expect(await probeBlob(new File([bytes], 'photo', { type: '' }))).toMatchObject(expected);
      expect(await probeBlob(new File([bytes], 'photo.jpg', { type: 'image/jpeg' }))).toMatchObject(expected);
      expect(await probeBlob(new File([bytes], 'IMG_0001.HEIC', { type: 'image/heic' }))).toMatchObject(expected);
    });

    it('matches the capability sample embedded in the worker', async () => {
      const { HEIC_SAMPLE_BASE64, HEIC_SAMPLE_SIZE } = await import('../src/worker/heic-sample.ts');
      expect(Buffer.from(HEIC_SAMPLE_BASE64, 'base64')).toEqual(Buffer.from(fixture('probe.heic')));
      expect(await probeBlob(blob(fixture('probe.heic')))).toMatchObject({ kind: 'heic', ...HEIC_SAMPLE_SIZE });
    });
  });
});
