import { describe, expect, it } from 'vitest';
import { encodePxc, pxcRowBytes } from '../src/formats/pxc.ts';

/**
 * Port of the PXC reader in CrossPoint PR #1614 (SleepActivity::renderPxcSleepScreen)
 * and the stock cache reader in lib/Epub/Epub/blocks/ImageBlock.cpp: uint16 LE
 * width/height, then (width + 3) / 4 bytes per row, pixel value
 * (row[col >> 2] >> (6 - (col & 3) * 2)) & 3, with 0 = black and 3 = white.
 */
function readPxc(bytes: Uint8Array, screen?: { width: number; height: number }) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = v.getUint16(0, true);
  const height = v.getUint16(2, true);
  if (screen && (width !== screen.width || height !== screen.height)) throw new Error('size mismatch');
  const bpr = (width + 3) >> 2;
  if (bytes.length !== 4 + bpr * height) throw new Error('incomplete');
  const values: number[] = [];
  for (let row = 0; row < height; row++) {
    const rowBuf = bytes.subarray(4 + row * bpr, 4 + (row + 1) * bpr);
    for (let col = 0; col < width; col++) values.push((rowBuf[col >> 2]! >> (6 - (col & 3) * 2)) & 0x03);
  }
  return { width, height, values };
}

describe('PXC encoder', () => {
  it('writes the header and rows without extra padding', () => {
    for (const w of [1, 2, 3, 4, 5, 7, 9, 480, 481]) {
      const gray = new Uint8Array(w * 2);
      const bytes = encodePxc(w, 2, gray);
      expect(bytes.length).toBe(4 + pxcRowBytes(w) * 2);
      expect(pxcRowBytes(w)).toBe(Math.ceil(w / 4));
    }
  });

  it('round-trips through the upstream reader logic', () => {
    const w = 7;
    const h = 3;
    const gray = new Uint8Array(w * h);
    const levels = [0, 85, 170, 255];
    for (let i = 0; i < gray.length; i++) gray[i] = levels[i % 4]!;
    const bytes = encodePxc(w, h, gray);
    const r = readPxc(bytes, { width: w, height: h });
    expect(r.values).toEqual([...gray].map((v) => v / 85));
  });

  it('maps black to 0 and white to 3, MSB first', () => {
    const bytes = encodePxc(4, 1, new Uint8Array([0, 255, 85, 170]));
    expect([...bytes]).toEqual([4, 0, 1, 0, 0b00110110]);
  });

  it('matches the Xteink X4 screen check', () => {
    const bytes = encodePxc(480, 800, new Uint8Array(480 * 800).fill(255));
    expect(() => readPxc(bytes, { width: 480, height: 800 })).not.toThrow();
    expect(() => readPxc(bytes, { width: 528, height: 792 })).toThrow('size mismatch');
  });

  it('rejects out-of-range sizes', () => {
    expect(() => encodePxc(70000, 1, new Uint8Array(70000))).toThrow();
    expect(() => encodePxc(2, 2, new Uint8Array(3))).toThrow();
  });
});
