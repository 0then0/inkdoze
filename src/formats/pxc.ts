import { levelIndex } from '../pipeline/tone.ts';

/**
 * CrossPoint pixel cache (.pxc): 4-byte header (uint16 LE width, uint16 LE height),
 * then rows of 2-bit pixels, four per byte, most significant bits first, row length
 * ceil(width / 4) bytes with no further padding. Value 0 is black and 3 is white,
 * matching CrossPoint's native gray levels 0/85/170/255.
 *
 * Stock CrossPoint 2.0.0 only uses this layout as an internal cache. Loading .pxc
 * files as sleep images exists in the unmerged PR #1614, so the catalog does not
 * offer PXC for any released firmware.
 */
export function pxcRowBytes(width: number): number {
  return Math.ceil(width / 4);
}

export function encodePxc(width: number, height: number, gray: Uint8Array): Uint8Array {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || width > 0xffff || height > 0xffff) {
    throw new RangeError('PXC dimensions must be integers in 1..65535');
  }
  if (gray.length !== width * height) throw new RangeError('PXC needs a grayscale plane');
  const row = pxcRowBytes(width);
  const out = new Uint8Array(4 + row * height);
  const view = new DataView(out.buffer);
  view.setUint16(0, width, true);
  view.setUint16(2, height, true);
  for (let y = 0; y < height; y++) {
    const base = 4 + y * row;
    for (let x = 0; x < width; x++) {
      const v = levelIndex(gray[y * width + x]!, 4);
      out[base + (x >> 2)]! |= v << (6 - (x & 3) * 2);
    }
  }
  return out;
}
