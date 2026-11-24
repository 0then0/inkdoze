/**
 * Structural reader for HEIF files (ISO/IEC 23008-12 on ISO BMFF). It identifies the
 * primary image and its size from the `meta` box without decoding pixels, so oversized
 * or damaged photos are rejected before a decoder allocates memory for them.
 *
 * Supported: a primary `hvc1` item (HEIC) or a `grid` of `hvc1` tiles, which is how
 * iPhones store photos. AVIF and other ISO BMFF files (MP4, MOV) are reported as
 * `unsupported`; image sequences and other HEIF codings as `variant`.
 */

/** Random access to the file: returns up to `length` bytes starting at `offset`. */
export type ByteReader = (offset: number, length: number) => Promise<Uint8Array>;

export interface HeicInfo {
  kind: 'heic';
  /** Size after the transformative properties (`clap`, `irot`), as displayed. */
  width: number;
  height: number;
  /** Pixels the decoder produces before cropping and rotation; the whole tile canvas for a grid. */
  decodePixels: number;
  /** Rotation in 90° steps counter-clockwise and mirroring, from `irot`/`imir`. */
  rotation: 0 | 1 | 2 | 3;
  mirror: boolean;
  /** Number of coded images: 1, or the tile count of a grid. */
  tiles: number;
  /** An 8-bit primary image with the confirmed Display P3 ICC profile. */
  displayP3?: true;
}

/**
 * - `unsupported`: not a HEIF image, or an AVIF image.
 * - `variant`: a HEIF file this decoder path does not handle (sequence, other codec, derived image).
 * - `corrupt`: the container is damaged or its sizes cannot be determined.
 */
export type HeifError = 'unsupported' | 'variant' | 'corrupt';

/** What the file brands and primary item say the file is. Exported for tests. */
export type HeifFamily = 'heic' | 'avif' | 'heif' | 'other';

const MAX_TOP_LEVEL_BOXES = 1024;
/** iPhone photos have `meta` boxes of a few KiB; 48 MP grids stay well under 64 KiB. */
const MAX_META_BYTES = 8 * 1024 * 1024;
const MAX_ITEMS = 65_536;

// The complete Apple Display P3.icc from https://registry.color.org/rgb-registry/displayp3.
// Compare the payload, including the matrix and tone curves. The description alone is not an identifier.
const DISPLAY_P3_ICC = atob(
  'AAACGGFwcGwEAAAAbW50clJHQiBYWVogB+YAAQABAAAAAAAAYWNzcEFQUEwAAAAAQVBQTAAAAAAAAAAAAAAAAAAAAA' +
  'AAAPbWAAEAAAAA0y1hcHBs7P2jjjiFR8NttL1PetoYLwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKZGVz' +
  'YwAAAPwAAAAwY3BydAAAASwAAABQd3RwdAAAAXwAAAAUclhZWgAAAZAAAAAUZ1hZWgAAAaQAAAAUYlhZWgAAAbgAAA' +
  'AUclRSQwAAAcwAAAAgY2hhZAAAAewAAAAsYlRSQwAAAcwAAAAgZ1RSQwAAAcwAAAAgbWx1YwAAAAAAAAABAAAADGVu' +
  'VVMAAAAUAAAAHABEAGkAcwBwAGwAYQB5ACAAUAAzbWx1YwAAAAAAAAABAAAADGVuVVMAAAA0AAAAHABDAG8AcAB5AH' +
  'IAaQBnAGgAdAAgAEEAcABwAGwAZQAgAEkAbgBjAC4ALAAgADIAMAAyADJYWVogAAAAAAAA9tUAAQAAAADTLFhZWiAA' +
  'AAAAAACD3wAAPb////+7WFlaIAAAAAAAAEq/AACxNwAACrlYWVogAAAAAAAAKDgAABELAADIuXBhcmEAAAAAAAMAAA' +
  'ACZmYAAPKnAAANWQAAE9AAAApbc2YzMgAAAAAAAQxCAAAF3v//8yYAAAeTAAD9kP//+6L///2jAAAD3AAAwG4=',
);

const AVIF_BRANDS = new Set(['avif', 'avis', 'avio']);
const HEIC_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'hevm', 'hevs', 'MiHE', 'MiHB']);
const HEIF_BRANDS = new Set(['mif1', 'mif2', 'mif3', 'msf1', 'miaf', ...HEIC_BRANDS, ...AVIF_BRANDS]);

class Corrupt extends Error {
  constructor(what: string) {
    super(what);
    this.name = 'Corrupt';
  }
}

class Variant extends Error {
  constructor(what: string) {
    super(what);
    this.name = 'Variant';
  }
}

const fourcc = (b: Uint8Array, o: number) => String.fromCharCode(b[o]!, b[o + 1]!, b[o + 2]!, b[o + 3]!);

/** Big-endian reader over a byte range that throws `Corrupt` instead of reading past its end. */
class Cursor {
  readonly b: Uint8Array;
  p: number;
  readonly end: number;

  constructor(b: Uint8Array, start = 0, end = b.length) {
    this.b = b;
    this.p = start;
    this.end = end;
  }

  need(n: number) {
    if (n < 0 || this.p + n > this.end) throw new Corrupt('box ends early');
  }

  u8() {
    this.need(1);
    return this.b[this.p++]!;
  }

  u16() {
    this.need(2);
    const v = (this.b[this.p]! << 8) | this.b[this.p + 1]!;
    this.p += 2;
    return v;
  }

  u32() {
    this.need(4);
    const b = this.b, p = this.p;
    this.p += 4;
    return ((b[p]! << 24) | (b[p + 1]! << 16) | (b[p + 2]! << 8) | b[p + 3]!) >>> 0;
  }

  /** Unsigned integer of 0, 2 (16-bit), 4 or 8 bytes. */
  uint(size: number) {
    if (size === 0) return 0;
    if (size === 2) return this.u16();
    if (size === 4) return this.u32();
    if (size === 8) {
      const hi = this.u32(), lo = this.u32();
      const v = hi * 2 ** 32 + lo;
      if (!Number.isSafeInteger(v)) throw new Corrupt('64-bit value out of range');
      return v;
    }
    throw new Corrupt(`field size ${size}`);
  }

  fourcc() {
    this.need(4);
    const v = fourcc(this.b, this.p);
    this.p += 4;
    return v;
  }

  skip(n: number) {
    this.need(n);
    this.p += n;
  }
}

interface Box {
  type: string;
  /** Payload range inside the buffer (after the header). */
  start: number;
  end: number;
}

/** Child boxes of a payload range. */
function boxes(b: Uint8Array, start: number, end: number): Box[] {
  const out: Box[] = [];
  const c = new Cursor(b, start, end);
  while (c.p < end) {
    const at = c.p;
    let size = c.u32();
    const type = c.fourcc();
    if (size === 1) size = c.uint(8);
    else if (size === 0) size = end - at;
    const header = c.p - at;
    if (size < header || at + size > end) throw new Corrupt(`'${type}' box size`);
    out.push({ type, start: c.p, end: at + size });
    c.p = at + size;
    if (out.length > MAX_ITEMS * 2) throw new Corrupt('too many boxes');
  }
  return out;
}

/** Skip the version and flags of a FullBox. */
function fullBox(b: Uint8Array, box: Box): { c: Cursor; version: number; flags: number } {
  const c = new Cursor(b, box.start, box.end);
  const version = c.u8();
  const flags = (c.u8() << 16) | (c.u8() << 8) | c.u8();
  return { c, version, flags };
}

interface Extent {
  offset: number;
  length: number;
}

interface Location {
  method: number;
  dataRef: number;
  extents: Extent[];
}

interface Property {
  type: string;
  box: Box;
}

interface Meta {
  bytes: Uint8Array;
  handler: string;
  primary: number;
  types: Map<number, string>;
  locations: Map<number, Location>;
  properties: Property[];
  /** item ID → 1-based property indexes, in ipma order. */
  associations: Map<number, number[]>;
  /** `dimg` references: derived item ID → source item IDs. */
  dimg: Map<number, number[]>;
  idat: Box | null;
}

function parseMeta(bytes: Uint8Array): Meta {
  const meta: Meta = {
    bytes,
    handler: '',
    primary: -1,
    types: new Map(),
    locations: new Map(),
    properties: [],
    associations: new Map(),
    dimg: new Map(),
    idat: null,
  };
  // `bytes` holds the whole meta box: header (8 or 16 bytes) + version/flags.
  const top = boxes(bytes, 0, bytes.length)[0];
  if (!top || top.type !== 'meta') throw new Corrupt('meta');
  for (const box of boxes(bytes, top.start + 4, top.end)) {
    switch (box.type) {
      case 'hdlr': {
        const { c } = fullBox(bytes, box);
        c.skip(4);
        meta.handler = c.fourcc();
        break;
      }
      case 'pitm': {
        const { c, version } = fullBox(bytes, box);
        meta.primary = version === 0 ? c.u16() : c.u32();
        break;
      }
      case 'iinf': {
        const { c, version } = fullBox(bytes, box);
        const count = version === 0 ? c.u16() : c.u32();
        if (count > MAX_ITEMS) throw new Corrupt('item count');
        for (const infe of boxes(bytes, c.p, box.end)) {
          if (infe.type !== 'infe') continue;
          const f = fullBox(bytes, infe);
          // Versions 0 and 1 describe non-image items without an item type.
          if (f.version < 2) continue;
          const id = f.version === 2 ? f.c.u16() : f.c.u32();
          f.c.skip(2);
          meta.types.set(id, f.c.fourcc());
        }
        break;
      }
      case 'iloc': {
        const { c, version } = fullBox(bytes, box);
        if (version > 2) throw new Variant(`iloc version ${version}`);
        const sizes = c.u8();
        const more = c.u8();
        const offsetSize = sizes >> 4, lengthSize = sizes & 15, baseSize = more >> 4;
        const indexSize = version > 0 ? more & 15 : 0;
        const count = version < 2 ? c.u16() : c.u32();
        if (count > MAX_ITEMS) throw new Corrupt('location count');
        for (let i = 0; i < count; i++) {
          const id = version < 2 ? c.u16() : c.u32();
          const method = version > 0 ? c.u16() & 15 : 0;
          const dataRef = c.u16();
          const base = c.uint(baseSize);
          const n = c.u16();
          const extents: Extent[] = [];
          for (let e = 0; e < n; e++) {
            c.uint(indexSize);
            extents.push({ offset: base + c.uint(offsetSize), length: c.uint(lengthSize) });
          }
          meta.locations.set(id, { method, dataRef, extents });
        }
        break;
      }
      case 'iprp': {
        for (const child of boxes(bytes, box.start, box.end)) {
          if (child.type === 'ipco') {
            for (const p of boxes(bytes, child.start, child.end)) meta.properties.push({ type: p.type, box: p });
          } else if (child.type === 'ipma') {
            const { c, version, flags } = fullBox(bytes, child);
            const count = c.u32();
            if (count > MAX_ITEMS) throw new Corrupt('association count');
            for (let i = 0; i < count; i++) {
              const id = version < 1 ? c.u16() : c.u32();
              const n = c.u8();
              const list = meta.associations.get(id) ?? [];
              for (let k = 0; k < n; k++) list.push(flags & 1 ? c.u16() & 0x7fff : c.u8() & 0x7f);
              meta.associations.set(id, list);
            }
          }
        }
        break;
      }
      case 'iref': {
        const { c, version } = fullBox(bytes, box);
        for (const ref of boxes(bytes, c.p, box.end)) {
          const r = new Cursor(bytes, ref.start, ref.end);
          const from = version === 0 ? r.u16() : r.u32();
          const n = r.u16();
          const to: number[] = [];
          for (let k = 0; k < n; k++) to.push(version === 0 ? r.u16() : r.u32());
          if (ref.type === 'dimg') meta.dimg.set(from, to);
        }
        break;
      }
      case 'idat':
        meta.idat = box;
        break;
    }
  }
  return meta;
}

function propertiesOf(meta: Meta, id: number): Property[] {
  const out: Property[] = [];
  for (const index of meta.associations.get(id) ?? []) {
    if (index === 0) continue;
    const p = meta.properties[index - 1];
    if (!p) throw new Corrupt(`property ${index} of item ${id}`);
    out.push(p);
  }
  return out;
}

/** A grid must identify its own RGB space. Its tiles may omit ICC or carry the same profile. */
function hasCompatibleColor(meta: Meta, props: Property[], requireIcc: boolean): boolean {
  let icc = false;
  let nclx = false;
  for (const { type, box: { start, end } } of props) {
    if (type !== 'colr') continue;
    if (end - start < 4) return false;
    const colourType = fourcc(meta.bytes, start);
    const data = start + 4;
    if (colourType === 'nclx') {
      // libheif uses CICP for YCbCr matrix and range. ICC still describes the
      // resulting RGB. Allow SDR or unspecified transfer signalling alongside it.
      if (nclx || end - data !== 7 || (meta.bytes[data + 6]! & 0x7f) !== 0) return false;
      const transfer = (meta.bytes[data + 2]! << 8) | meta.bytes[data + 3]!;
      if (transfer !== 1 && transfer !== 2 && transfer !== 6 && transfer !== 13) return false;
      nclx = true;
    } else {
      if (icc || (colourType !== 'prof' && colourType !== 'rICC') || end - data !== DISPLAY_P3_ICC.length) return false;
      for (let i = 0; i < DISPLAY_P3_ICC.length; i++) {
        if (meta.bytes[data + i] !== DISPLAY_P3_ICC.charCodeAt(i)) return false;
      }
      icc = true;
    }
  }
  return icc || !requireIcc;
}

function has8BitHevc(meta: Meta, props: Property[]): boolean {
  const box = props.find((p) => p.type === 'hvcC')?.box;
  if (!box || box.end - box.start < 23 || meta.bytes[box.start] !== 1) return false;
  // HEVCDecoderConfigurationRecord bitDepthLumaMinus8 and bitDepthChromaMinus8.
  return ((meta.bytes[box.start + 17]! | meta.bytes[box.start + 18]!) & 7) === 0;
}

function ispe(meta: Meta, id: number): { width: number; height: number } {
  const p = propertiesOf(meta, id).find((x) => x.type === 'ispe');
  if (!p) throw new Corrupt(`no size for item ${id}`);
  const { c } = fullBox(meta.bytes, p.box);
  const width = c.u32(), height = c.u32();
  if (width === 0 || height === 0) throw new Corrupt(`zero size for item ${id}`);
  return { width, height };
}

/** Read an item's data (only small items: the grid descriptor). */
async function itemData(meta: Meta, id: number, read: ByteReader, fileSize: number, max: number): Promise<Uint8Array> {
  const loc = meta.locations.get(id);
  if (!loc || loc.extents.length === 0) throw new Corrupt(`no data for item ${id}`);
  if (loc.dataRef !== 0) throw new Variant('item data in another file');
  const parts: Uint8Array[] = [];
  let total = 0;
  for (const e of loc.extents) {
    if (total >= max) break;
    let chunk: Uint8Array;
    if (loc.method === 0) {
      const length = e.length === 0 ? fileSize - e.offset : e.length;
      if (e.offset + length > fileSize) throw new Corrupt(`item ${id} data past end of file`);
      chunk = await read(e.offset, Math.min(length, max - total));
    } else if (loc.method === 1) {
      if (!meta.idat) throw new Corrupt('no idat');
      const length = e.length === 0 ? meta.idat.end - meta.idat.start - e.offset : e.length;
      const start = meta.idat.start + e.offset;
      if (length < 0 || start + length > meta.idat.end) throw new Corrupt(`item ${id} data past idat`);
      chunk = meta.bytes.subarray(start, start + Math.min(length, max - total));
    } else {
      throw new Variant(`construction method ${loc.method}`);
    }
    parts.push(chunk);
    total += chunk.length;
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function checkCodedItem(meta: Meta, id: number, fileSize: number) {
  const loc = meta.locations.get(id);
  if (!loc || loc.extents.length === 0) throw new Corrupt(`no data for item ${id}`);
  if (loc.dataRef !== 0) throw new Variant('item data in another file');
  for (const e of loc.extents) {
    const end = loc.method === 0 ? fileSize : loc.method === 1 && meta.idat ? meta.idat.end - meta.idat.start : -1;
    if (end < 0) throw new Variant(`construction method ${loc.method}`);
    if (e.offset + e.length > end) throw new Corrupt(`item ${id} data past the end`);
  }
  const props = propertiesOf(meta, id);
  if (!props.some((p) => p.type === 'hvcC')) throw new Corrupt(`no decoder configuration for item ${id}`);
  return props;
}

/** Apply `clap`, `irot` and `imir` in their association order to the coded size. */
function transform(meta: Meta, id: number, size: { width: number; height: number }) {
  let { width, height } = size;
  let rotation: HeicInfo['rotation'] = 0;
  let mirror = false;
  for (const p of propertiesOf(meta, id)) {
    if (p.type === 'clap') {
      const c = new Cursor(meta.bytes, p.box.start, p.box.end);
      const wn = c.u32(), wd = c.u32(), hn = c.u32(), hd = c.u32();
      if (wd === 0 || hd === 0) throw new Corrupt('clap denominator');
      const w = Math.round(wn / wd), h = Math.round(hn / hd);
      if (w < 1 || h < 1 || w > width || h > height) throw new Corrupt('clap size');
      width = w;
      height = h;
    } else if (p.type === 'irot') {
      if (p.box.end <= p.box.start) throw new Corrupt('irot');
      const angle = (meta.bytes[p.box.start]! & 3) as HeicInfo['rotation'];
      if (angle & 1) [width, height] = [height, width];
      rotation = ((rotation + angle) & 3) as HeicInfo['rotation'];
    } else if (p.type === 'imir') {
      if (p.box.end <= p.box.start) throw new Corrupt('imir');
      mirror = !mirror;
    }
  }
  return { width, height, rotation, mirror };
}

/** Classify by brands alone, for files without an image `meta` box. */
export function familyFromBrands(brands: string[]): HeifFamily {
  if (brands.some((b) => AVIF_BRANDS.has(b))) return 'avif';
  if (brands.some((b) => HEIC_BRANDS.has(b))) return 'heic';
  if (brands.some((b) => HEIF_BRANDS.has(b))) return 'heif';
  return 'other';
}

async function readTopLevel(read: ByteReader, size: number) {
  let offset = 0;
  let brands: string[] | null = null;
  let meta: Uint8Array | null = null;
  for (let n = 0; offset < size; n++) {
    if (n >= MAX_TOP_LEVEL_BOXES) throw new Corrupt('too many top-level boxes');
    const head = await read(offset, Math.min(16, size - offset));
    if (head.length < 8) throw new Corrupt('box header cut off');
    const c = new Cursor(head);
    let boxSize = c.u32();
    const type = c.fourcc();
    if (boxSize === 1) boxSize = c.uint(8);
    else if (boxSize === 0) boxSize = size - offset;
    if (boxSize < c.p || offset + boxSize > size) throw new Corrupt(`'${type}' box runs past the end of the file`);
    if (n === 0 && type !== 'ftyp') throw new Corrupt('no ftyp');
    if (type === 'ftyp') {
      if (boxSize > 4096 || boxSize < c.p + 8) throw new Corrupt('ftyp size');
      const b = await read(offset + c.p, boxSize - c.p);
      brands = [];
      for (let p = 0; p + 4 <= b.length; p += 4) if (p !== 4) brands.push(fourcc(b, p));
    } else if (type === 'meta' && !meta) {
      if (boxSize > MAX_META_BYTES) throw new Corrupt('meta box too large');
      meta = await read(offset, boxSize);
    }
    // Later boxes are only checked for their size, which catches a cut-off mdat.
    offset += boxSize;
  }
  return { brands: brands ?? [], meta };
}

/**
 * Identify a HEIC file and the size of its primary image.
 * `read` must return the requested range, shorter only at the end of the file.
 */
export async function probeHeif(read: ByteReader, size: number): Promise<HeicInfo | HeifError> {
  try {
    const top = await readTopLevel(read, size);
    const meta = top.meta ? parseMeta(top.meta) : null;
    if (!meta || meta.handler !== 'pict') {
      // No still image: a sequence (HEICS, AVIS) or a video container.
      const family = familyFromBrands(top.brands);
      return family === 'heic' || family === 'heif' ? 'variant' : 'unsupported';
    }
    const type = meta.types.get(meta.primary);
    if (type === undefined) throw new Corrupt('primary item missing');
    const family = itemFamily(meta, meta.primary, type);
    if (family === 'avif' || family === 'other') return 'unsupported';
    if (family === 'heif') return 'variant';

    let decodePixels: number;
    let coded: { width: number; height: number };
    let tiles = 1;
    let displayP3 = hasCompatibleColor(meta, propertiesOf(meta, meta.primary), true);
    if (type === 'hvc1') {
      const props = checkCodedItem(meta, meta.primary, size);
      displayP3 &&= has8BitHevc(meta, props);
      coded = ispe(meta, meta.primary);
      decodePixels = coded.width * coded.height;
    } else {
      const grid = await gridLayout(meta, read, size, displayP3);
      coded = { width: grid.width, height: grid.height };
      decodePixels = grid.decodePixels;
      tiles = grid.tiles;
      displayP3 = grid.displayP3;
    }
    const t = transform(meta, meta.primary, coded);
    return { kind: 'heic', ...t, decodePixels, tiles, ...(displayP3 ? { displayP3: true } : {}) };
  } catch (e) {
    if (e instanceof Corrupt) return 'corrupt';
    if (e instanceof Variant) return 'variant';
    throw e;
  }
}

/** HEIC for `hvc1` and grids of `hvc1`, AVIF for `av01`, plain HEIF for other image codings. */
function itemFamily(meta: Meta, id: number, type: string): HeifFamily {
  if (type === 'hvc1') return 'heic';
  if (type === 'av01') return 'avif';
  if (type === 'grid') {
    const first = meta.dimg.get(id)?.[0];
    const tileType = first === undefined ? undefined : meta.types.get(first);
    if (tileType === undefined) throw new Corrupt('grid without tiles');
    return tileType === 'grid' ? 'heif' : itemFamily(meta, first!, tileType);
  }
  // `iden`, `ovl`, `tmap`, `unci`, `jpeg`, `j2k1`, `vvc1`, …
  return 'heif';
}

async function gridLayout(meta: Meta, read: ByteReader, size: number, displayP3: boolean) {
  const id = meta.primary;
  const d = new Cursor(await itemData(meta, id, read, size, 12));
  const version = d.u8();
  if (version !== 0) throw new Variant(`grid version ${version}`);
  const flags = d.u8();
  const rows = d.u8() + 1;
  const columns = d.u8() + 1;
  const width = flags & 1 ? d.u32() : d.u16();
  const height = flags & 1 ? d.u32() : d.u16();
  if (width === 0 || height === 0) throw new Corrupt('grid output size');
  const tiles = meta.dimg.get(id) ?? [];
  if (tiles.length !== rows * columns) throw new Corrupt(`grid has ${tiles.length} tiles for ${rows}×${columns}`);
  let tile: { width: number; height: number } | null = null;
  for (const t of tiles) {
    if (meta.types.get(t) !== 'hvc1') throw new Corrupt(`grid tile ${t} is not HEVC`);
    const props = checkCodedItem(meta, t, size);
    displayP3 &&= has8BitHevc(meta, props) && hasCompatibleColor(meta, props, false);
    const s = ispe(meta, t);
    if (tile && (s.width !== tile.width || s.height !== tile.height)) throw new Corrupt('grid tiles differ in size');
    tile = s;
  }
  // The tiles must cover the output canvas; the decoder decodes every tile in full.
  if (!tile || tile.width * columns < width || tile.height * rows < height) throw new Corrupt('grid tiles do not cover the image');
  const own = propertiesOf(meta, id).find((p) => p.type === 'ispe');
  if (own) {
    const s = ispe(meta, id);
    if (s.width !== width || s.height !== height) throw new Corrupt('grid size disagrees with ispe');
  }
  return { width, height, tiles: tiles.length, decodePixels: tile.width * tile.height * tiles.length, displayP3 };
}

/** True for files that start with an ISO BMFF `ftyp` box. */
export function isIsoBmff(bytes: Uint8Array): boolean {
  if (bytes.length < 16) return false;
  const size = ((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0;
  return fourcc(bytes, 4) === 'ftyp' && (size >= 16 || size === 1);
}
