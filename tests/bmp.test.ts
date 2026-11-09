import { describe, expect, it } from 'vitest';
import { bmpRowStride, encodeBmp, type BmpDepth } from '../src/formats/bmp.ts';
import { paletteFor } from '../src/pipeline/tone.ts';

/**
 * Generic BMP reader written from the BITMAPINFOHEADER spec, independent of the
 * encoder: returns gray or RGB values per pixel in top-down order.
 */
function decodeBmp(bytes: Uint8Array) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes[0] !== 0x42 || bytes[1] !== 0x4d) throw new Error('not BMP');
  const fileSize = v.getUint32(2, true);
  const offset = v.getUint32(10, true);
  const headerSize = v.getUint32(14, true);
  const width = v.getInt32(18, true);
  const rawHeight = v.getInt32(22, true);
  const planes = v.getUint16(26, true);
  const bpp = v.getUint16(28, true);
  const compression = v.getUint32(30, true);
  const imageSize = v.getUint32(34, true);
  let colors = v.getUint32(46, true);
  if (colors === 0 && bpp <= 8) colors = 1 << bpp;
  const palette: Array<[number, number, number]> = [];
  for (let i = 0; i < colors; i++) {
    const p = 14 + headerSize + i * 4;
    palette.push([bytes[p + 2]!, bytes[p + 1]!, bytes[p]!]);
  }
  const height = Math.abs(rawHeight);
  const topDown = rawHeight < 0;
  const stride = Math.floor((width * bpp + 31) / 32) * 4;
  const pixels: Array<[number, number, number]> = [];
  for (let y = 0; y < height; y++) {
    const row = offset + (topDown ? y : height - 1 - y) * stride;
    for (let x = 0; x < width; x++) {
      if (bpp === 24) {
        const p = row + x * 3;
        pixels.push([bytes[p + 2]!, bytes[p + 1]!, bytes[p]!]);
      } else {
        const bit = x * bpp;
        const byte = bytes[row + (bit >> 3)]!;
        const idx = (byte >> (8 - bpp - (bit & 7))) & ((1 << bpp) - 1);
        pixels.push(palette[idx]!);
      }
    }
  }
  return { fileSize, offset, headerSize, width, height, planes, bpp, compression, imageSize, colors, palette, pixels, stride, topDown };
}

/**
 * Port of the acceptance checks in CrossPoint 2.0.0 Bitmap::parseHeaders()
 * (lib/GfxRenderer/Bitmap.cpp). Returns null when CrossPoint would accept the file.
 */
function crossPointRejects(bytes: Uint8Array): string | null {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (v.getUint16(0, true) !== 0x4d42) return 'NotBMP';
  if (v.getUint32(14, true) < 40) return 'DIBTooSmall';
  const width = v.getInt32(18, true);
  const rawHeight = v.getInt32(22, true);
  const height = Math.abs(rawHeight);
  if (v.getUint16(26, true) !== 1) return 'BadPlanes';
  const bpp = v.getUint16(28, true);
  if (![1, 2, 4, 8, 24, 32].includes(bpp)) return 'UnsupportedBpp';
  const comp = v.getUint32(30, true);
  if (!(comp === 0 || (bpp === 32 && comp === 3))) return 'UnsupportedCompression';
  let colorsUsed = v.getUint32(46, true);
  if (colorsUsed === 0 && bpp <= 8) colorsUsed = 1 << bpp;
  if (colorsUsed > 256) return 'PaletteTooLarge';
  if (width <= 0 || height <= 0) return 'BadDimensions';
  if (width > 2048 || height > 3072) return 'ImageTooLarge';
  const rowBytes = Math.floor((width * bpp + 31) / 32) * 4;
  const offBits = v.getUint32(10, true);
  if (offBits + rowBytes * height > bytes.length) return 'ShortFile';
  return null;
}

/** CrossPoint treats a palette as native when every entry is within 21 of 0/85/170/255. */
function crossPointNativePalette(bytes: Uint8Array): boolean {
  const d = decodeBmp(bytes);
  if (d.bpp <= 2) return true;
  return d.palette.every(([r, g, b]) => {
    const lum = (77 * r + 150 * g + 29 * b) >> 8;
    const level = lum >> 6;
    const rec = level * 85;
    return !(lum > rec + 21 || lum + 21 < rec);
  });
}

function grayPattern(w: number, h: number, levels: number): Uint8Array {
  const pal = paletteFor(levels as 2 | 4 | 16 | 256);
  const g = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = pal[(x * 7 + y * 3) % pal.length]!;
  return g;
}

describe('BMP row alignment', () => {
  it('pads every row to a 4-byte boundary', () => {
    expect(bmpRowStride(1, 1)).toBe(4);
    expect(bmpRowStride(33, 1)).toBe(8);
    expect(bmpRowStride(15, 2)).toBe(4);
    expect(bmpRowStride(17, 2)).toBe(8);
    expect(bmpRowStride(9, 4)).toBe(8);
    expect(bmpRowStride(3, 8)).toBe(4);
    expect(bmpRowStride(5, 8)).toBe(8);
    expect(bmpRowStride(1, 24)).toBe(4);
    expect(bmpRowStride(3, 24)).toBe(12);
    expect(bmpRowStride(5, 24)).toBe(16);
  });
});

describe('BMP encoder', () => {
  const depths: Array<[BmpDepth, number]> = [
    [1, 2],
    [2, 4],
    [4, 16],
    [8, 256],
  ];

  for (const [depth, levels] of depths) {
    for (const width of [1, 3, 5, 7, 8, 13, 16, 17, 31, 33]) {
      it(`round-trips ${depth}-bit gray at width ${width}`, () => {
        const h = 3;
        const gray = grayPattern(width, h, levels);
        const bytes = encodeBmp(width, h, depth, { gray });
        const d = decodeBmp(bytes);
        expect(d.width).toBe(width);
        expect(d.height).toBe(h);
        expect(d.bpp).toBe(depth);
        expect(d.planes).toBe(1);
        expect(d.compression).toBe(0);
        expect(d.colors).toBe(1 << depth);
        expect(d.stride % 4).toBe(0);
        expect(d.imageSize).toBe(d.stride * h);
        expect(d.fileSize).toBe(bytes.length);
        expect(d.offset).toBe(14 + 40 + (1 << depth) * 4);
        expect(d.palette.map((p) => p[0])).toEqual(paletteFor(levels as 2 | 4 | 16 | 256));
        expect(d.pixels.map((p) => p[0])).toEqual([...gray]);
        expect(crossPointRejects(bytes)).toBeNull();
      });
    }
  }

  it('writes padding bytes as zero', () => {
    const bytes = encodeBmp(5, 2, 8, { gray: new Uint8Array(10).fill(255) });
    const d = decodeBmp(bytes);
    for (let y = 0; y < 2; y++) {
      const row = d.offset + y * d.stride;
      expect([...bytes.slice(row + 5, row + d.stride)]).toEqual([0, 0, 0]);
    }
  });

  it('stores rows bottom-up', () => {
    const gray = new Uint8Array([0, 0, 255, 255]); // top row black, bottom row white
    const bytes = encodeBmp(2, 2, 8, { gray });
    const d = decodeBmp(bytes);
    expect(d.topDown).toBe(false);
    // First stored row is the bottom (white) row.
    expect(bytes[d.offset]).toBe(255);
    expect(bytes[d.offset + d.stride]).toBe(0);
  });

  it('packs 2-bit pixels MSB first with CrossPoint levels', () => {
    const gray = new Uint8Array([0, 85, 170, 255, 255]);
    const bytes = encodeBmp(5, 1, 2, { gray });
    const d = decodeBmp(bytes);
    expect(bytes[d.offset]).toBe(0b00011011);
    expect(bytes[d.offset + 1]).toBe(0b11000000);
    expect(d.palette).toEqual([
      [0, 0, 0],
      [85, 85, 85],
      [170, 170, 170],
      [255, 255, 255],
    ]);
    expect(crossPointNativePalette(bytes)).toBe(true);
  });

  it('packs 1-bit pixels with 0 = black', () => {
    const gray = new Uint8Array([255, 0, 0, 0, 0, 0, 0, 0, 255]);
    const bytes = encodeBmp(9, 1, 1, { gray });
    const d = decodeBmp(bytes);
    expect(bytes[d.offset]).toBe(0b10000000);
    expect(bytes[d.offset + 1]).toBe(0b10000000);
    expect(d.palette).toEqual([
      [0, 0, 0],
      [255, 255, 255],
    ]);
  });

  it('writes 24-bit BGR from RGBA and ignores alpha', () => {
    const rgba = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 0, 0, 0, 255, 128]);
    const bytes = encodeBmp(3, 1, 24, { rgba });
    const d = decodeBmp(bytes);
    expect(d.pixels).toEqual([
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
    ]);
    expect([...bytes.slice(d.offset, d.offset + 3)]).toEqual([0, 0, 255]);
    expect(d.stride).toBe(12);
    expect(crossPointRejects(bytes)).toBeNull();
  });

  it('matches a golden 2×2 8-bit file byte for byte', () => {
    const bytes = encodeBmp(2, 2, 8, { gray: new Uint8Array([0, 255, 128, 64]) });
    expect(bytes.length).toBe(14 + 40 + 1024 + 8);
    expect([...bytes.slice(0, 14)]).toEqual([0x42, 0x4d, 0x3e, 0x04, 0, 0, 0, 0, 0, 0, 0x36, 0x04, 0, 0]);
    expect([...bytes.slice(1078)]).toEqual([128, 64, 0, 0, 0, 255, 0, 0]);
  });

  it('produces CrossPoint-sized files at device resolutions', () => {
    const gray = new Uint8Array(480 * 800).fill(170);
    const bytes = encodeBmp(480, 800, 2, { gray });
    expect(bytes.length).toBe(14 + 40 + 16 + 120 * 800);
    expect(crossPointRejects(bytes)).toBeNull();
  });

  it('rejects mismatched input', () => {
    expect(() => encodeBmp(2, 2, 8, { gray: new Uint8Array(3) })).toThrow();
    expect(() => encodeBmp(2, 2, 24, { gray: new Uint8Array(4) })).toThrow();
    expect(() => encodeBmp(0, 2, 8, { gray: new Uint8Array(0) })).toThrow();
  });
});
