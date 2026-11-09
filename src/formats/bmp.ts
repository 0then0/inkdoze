import { levelIndex, paletteFor } from '../pipeline/tone.ts';
import type { Levels } from '../pipeline/types.ts';

export type BmpDepth = 1 | 2 | 4 | 8 | 24;

const FILE_HEADER = 14;
const INFO_HEADER = 40;
/** 72 dpi expressed in pixels per metre. */
const PPM = 2835;

/** Bytes per row including padding to a 4-byte boundary. */
export function bmpRowStride(width: number, bpp: number): number {
  return Math.ceil((width * bpp) / 32) * 4;
}

function levelsForDepth(depth: BmpDepth): Levels {
  switch (depth) {
    case 1:
      return 2;
    case 2:
      return 4;
    case 4:
      return 16;
    default:
      return 256;
  }
}

/**
 * Encode an uncompressed (BI_RGB) Windows BMP with a BITMAPINFOHEADER, bottom-up rows.
 * - 24-bit takes RGBA (alpha ignored, expected to be flattened already).
 * - 1/2/4/8-bit take a grayscale plane and write an evenly spaced gray palette:
 *   1-bit [0,255], 2-bit [0,85,170,255] (CrossPoint's native levels), 4-bit 16 grays, 8-bit 256 grays.
 *   Pixels are mapped to the nearest palette index.
 */
export function encodeBmp(
  width: number,
  height: number,
  depth: BmpDepth,
  data: { rgba?: Uint8ClampedArray | Uint8Array; gray?: Uint8Array },
): Uint8Array {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new RangeError('BMP dimensions must be positive integers');
  }
  const stride = bmpRowStride(width, depth);
  const paletteCount = depth === 24 ? 0 : 1 << depth;
  const paletteBytes = paletteCount * 4;
  const offset = FILE_HEADER + INFO_HEADER + paletteBytes;
  const imageSize = stride * height;
  const fileSize = offset + imageSize;
  const out = new Uint8Array(fileSize);
  const view = new DataView(out.buffer);

  // BITMAPFILEHEADER
  out[0] = 0x42; // 'B'
  out[1] = 0x4d; // 'M'
  view.setUint32(2, fileSize, true);
  view.setUint32(6, 0, true);
  view.setUint32(10, offset, true);
  // BITMAPINFOHEADER
  view.setUint32(14, INFO_HEADER, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true); // positive: bottom-up
  view.setUint16(26, 1, true);
  view.setUint16(28, depth, true);
  view.setUint32(30, 0, true); // BI_RGB
  view.setUint32(34, imageSize, true);
  view.setInt32(38, PPM, true);
  view.setInt32(42, PPM, true);
  view.setUint32(46, paletteCount, true);
  view.setUint32(50, paletteCount, true);

  if (depth === 24) {
    const rgba = data.rgba;
    if (!rgba || rgba.length !== width * height * 4) throw new RangeError('24-bit BMP needs RGBA input');
    for (let y = 0; y < height; y++) {
      const rowStart = offset + (height - 1 - y) * stride;
      for (let x = 0; x < width; x++) {
        const s = (y * width + x) * 4;
        const d = rowStart + x * 3;
        out[d] = rgba[s + 2]!;
        out[d + 1] = rgba[s + 1]!;
        out[d + 2] = rgba[s]!;
      }
    }
    return out;
  }

  const gray = data.gray;
  if (!gray || gray.length !== width * height) throw new RangeError('Paletted BMP needs a grayscale plane');
  const levels = levelsForDepth(depth);
  const palette = paletteFor(levels);
  for (let i = 0; i < palette.length; i++) {
    const p = FILE_HEADER + INFO_HEADER + i * 4;
    const v = palette[i]!;
    out[p] = v;
    out[p + 1] = v;
    out[p + 2] = v;
    out[p + 3] = 0;
  }
  const perByte = 8 / depth;
  const mask = (1 << depth) - 1;
  for (let y = 0; y < height; y++) {
    const rowStart = offset + (height - 1 - y) * stride;
    for (let x = 0; x < width; x++) {
      const idx = levelIndex(gray[y * width + x]!, levels) & mask;
      if (depth === 8) {
        out[rowStart + x] = idx;
        continue;
      }
      const byte = rowStart + Math.floor(x / perByte);
      const shift = 8 - depth * ((x % perByte) + 1); // MSB first
      out[byte]! |= idx << shift;
    }
  }
  return out;
}
