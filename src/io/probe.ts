/**
 * Read image dimensions from the file header without decoding pixels, so oversized
 * images are rejected before the browser allocates memory for them.
 */

export type ImageKind = 'png' | 'jpeg' | 'webp';

export interface ProbeResult {
  kind: ImageKind;
  width: number;
  height: number;
}

/** `truncated`: the header continues past the bytes provided; read more of the file. */
export type ProbeError = 'unsupported' | 'corrupt' | 'truncated';

const u16be = (b: Uint8Array, o: number) => (b[o]! << 8) | b[o + 1]!;
const u32be = (b: Uint8Array, o: number) => ((b[o]! << 24) | (b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!) >>> 0;
const u16le = (b: Uint8Array, o: number) => b[o]! | (b[o + 1]! << 8);
const u24le = (b: Uint8Array, o: number) => b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16);

export function sniff(bytes: Uint8Array): ImageKind | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'webp';
  }
  return null;
}

function probePng(b: Uint8Array): ProbeResult | ProbeError {
  // Signature (8) + IHDR length (4) + "IHDR" (4) + width (4) + height (4)
  if (b.length < 24) return 'truncated';
  if (b[12] !== 0x49 || b[13] !== 0x48 || b[14] !== 0x44 || b[15] !== 0x52) return 'corrupt';
  return { kind: 'png', width: u32be(b, 16), height: u32be(b, 20) };
}

function probeJpeg(b: Uint8Array): ProbeResult | ProbeError {
  let o = 2;
  while (o + 4 <= b.length) {
    if (b[o] !== 0xff) return 'corrupt';
    let marker = b[o + 1]!;
    while (marker === 0xff && o + 2 < b.length) {
      o++;
      marker = b[o + 1]!;
    }
    o += 2;
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) continue;
    if (marker === 0xd9 || marker === 0xda) return 'corrupt';
    if (o + 2 > b.length) return 'truncated';
    const len = u16be(b, o);
    if (len < 2) return 'corrupt';
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      if (o + 7 > b.length) return 'truncated';
      return { kind: 'jpeg', height: u16be(b, o + 3), width: u16be(b, o + 5) };
    }
    o += len;
  }
  // Metadata segments (EXIF, ICC, XMP) can push the frame header far into the file.
  return 'truncated';
}

function probeWebp(b: Uint8Array): ProbeResult | ProbeError {
  if (b.length < 30) return 'truncated';
  const chunk = String.fromCharCode(b[12]!, b[13]!, b[14]!, b[15]!);
  if (chunk === 'VP8X') return { kind: 'webp', width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
  if (chunk === 'VP8 ') {
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return 'corrupt';
    return { kind: 'webp', width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    if (b[20] !== 0x2f) return 'corrupt';
    const bits = b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24);
    return { kind: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  return 'corrupt';
}

/** Probe a byte prefix of a file. Returns `truncated` when the prefix is too short. */
export function probeImage(bytes: Uint8Array): ProbeResult | ProbeError {
  const kind = sniff(bytes);
  if (!kind) return 'unsupported';
  const r = kind === 'png' ? probePng(bytes) : kind === 'jpeg' ? probeJpeg(bytes) : probeWebp(bytes);
  if (typeof r === 'string') return r;
  if (r.width <= 0 || r.height <= 0) return 'corrupt';
  return r;
}

/**
 * Probe a file, reading a growing prefix (64 KiB, 1 MiB, then the whole file) until
 * the header is found. A header that is still incomplete at the end of the file is
 * reported as corrupt.
 */
export async function probeBlob(blob: Blob): Promise<ProbeResult | Exclude<ProbeError, 'truncated'>> {
  let size = 64 * 1024;
  for (;;) {
    const bytes = new Uint8Array(await blob.slice(0, size).arrayBuffer());
    const r = probeImage(bytes);
    if (r !== 'truncated') return r;
    if (size >= blob.size) return 'corrupt';
    size = Math.min(blob.size, size * 16);
  }
}
