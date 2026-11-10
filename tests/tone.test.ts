import { describe, expect, it } from 'vitest';
import { applyTone, autoToneCurve, composeLut, flattenAlpha, levelIndex, luma, paletteFor, parseHexColor, quantizeGray, toneCurve } from '../src/pipeline/tone.ts';
import type { Dither, Levels } from '../src/pipeline/types.ts';

describe('transparency', () => {
  it('replaces fully transparent pixels with the background', () => {
    const px = new Uint8ClampedArray([255, 0, 0, 0, 10, 20, 30, 255]);
    flattenAlpha(px, { r: 0, g: 0, b: 0 });
    expect([...px]).toEqual([0, 0, 0, 255, 10, 20, 30, 255]);
  });

  it('blends partial alpha over the background', () => {
    const px = new Uint8ClampedArray([200, 100, 0, 128]);
    flattenAlpha(px, parseHexColor('#ffffff'));
    const t = 128 / 255;
    expect([...px]).toEqual([Math.round(200 * t + 255 * (1 - t)), Math.round(100 * t + 255 * (1 - t)), Math.round(255 * (1 - t)), 255]);
  });

  it('parses colours and falls back to white', () => {
    expect(parseHexColor('#336699')).toEqual({ r: 0x33, g: 0x66, b: 0x99 });
    expect(parseHexColor('nope')).toEqual({ r: 255, g: 255, b: 255 });
  });
});

describe('tone', () => {
  it('uses CrossPoint luma weights', () => {
    expect(luma(255, 255, 255)).toBe(255);
    expect(luma(0, 0, 0)).toBe(0);
    expect(luma(255, 0, 0)).toBe(76);
  });

  it('is the identity at zero brightness and contrast', () => {
    const lut = toneCurve(0, 0, false);
    for (let i = 0; i < 256; i++) expect(lut[i]).toBe(i);
  });

  it('inverts', () => {
    const lut = toneCurve(0, 0, true);
    expect(lut[0]).toBe(255);
    expect(lut[255]).toBe(0);
  });

  it('brightens and adds contrast monotonically', () => {
    const b = toneCurve(50, 0, false);
    expect(b[100]).toBeGreaterThan(100);
    const c = toneCurve(0, 60, false);
    expect(c[64]).toBeLessThan(64);
    expect(c[192]).toBeGreaterThan(192);
    for (let i = 1; i < 256; i++) expect(c[i]!).toBeGreaterThanOrEqual(c[i - 1]!);
  });

  it('produces a grayscale plane in grayscale mode', () => {
    const px = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]);
    const g = applyTone(px, toneCurve(0, 0, false), true);
    expect(g && [...g]).toEqual([255, 0]);
  });
});

describe('palettes and dithering', () => {
  it('builds evenly spaced palettes', () => {
    expect(paletteFor(2)).toEqual([0, 255]);
    expect(paletteFor(4)).toEqual([0, 85, 170, 255]);
    expect(paletteFor(16)).toHaveLength(16);
    expect(paletteFor(16)[1]).toBe(17);
  });

  it('maps values to the nearest level', () => {
    expect(levelIndex(42, 4)).toBe(0);
    expect(levelIndex(43, 4)).toBe(1);
    expect(levelIndex(127, 2)).toBe(0);
    expect(levelIndex(128, 2)).toBe(1);
  });

  const gradient = (w: number, h: number) => {
    const g = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = Math.round((x / (w - 1)) * 255);
    return g;
  };

  for (const levels of [2, 4, 16] as Levels[]) {
    for (const dither of ['none', 'floyd-steinberg', 'atkinson'] as Dither[]) {
      it(`${levels} levels with ${dither} only emits palette values`, () => {
        const g = gradient(64, 16);
        quantizeGray(g, 64, 16, levels, dither);
        const palette = new Set(paletteFor(levels));
        for (const v of g) expect(palette.has(v)).toBe(true);
      });
    }
  }

  it('error diffusion preserves average brightness of a flat gray', () => {
    const w = 64;
    const h = 64;
    for (const dither of ['floyd-steinberg', 'atkinson'] as Dither[]) {
      const g = new Uint8Array(w * h).fill(100);
      quantizeGray(g, w, h, 2, dither);
      const mean = g.reduce((s, v) => s + v, 0) / g.length;
      // Atkinson discards a quarter of the error, so allow a wider band.
      expect(Math.abs(mean - 100)).toBeLessThan(dither === 'atkinson' ? 30 : 6);
      expect(new Set(g).size).toBe(2);
    }
  });

  it('leaves 256 levels untouched', () => {
    const g = gradient(16, 1);
    const copy = g.slice();
    quantizeGray(g, 16, 1, 256, 'floyd-steinberg');
    expect(g).toEqual(copy);
  });
});

describe('automatic tone', () => {
  const image = (w: number, h: number, value: (x: number, y: number) => number) => {
    const px = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const v = value(x, y);
        px.set([v, v, v, 255], (y * w + x) * 4);
      }
    return px;
  };
  const whole = (w: number, h: number) => ({ x: 0, y: 0, w, h });
  const monotonic = (lut: Uint8Array) => {
    for (let i = 1; i < 256; i++) expect(lut[i]!).toBeGreaterThanOrEqual(lut[i - 1]!);
  };

  it('stretches a washed-out image towards the full range', () => {
    const px = image(64, 64, (x) => 100 + Math.round((x / 63) * 50));
    const lut = autoToneCurve(px, 64, whole(64, 64));
    monotonic(lut);
    expect(lut[150]! - lut[100]!).toBeGreaterThan(100);
  });

  it('caps the gain so a nearly flat image is not blown out', () => {
    const px = image(32, 32, (x) => 120 + (x % 2));
    const lut = autoToneCurve(px, 32, whole(32, 32));
    monotonic(lut);
    expect(lut[121]! - lut[120]!).toBeLessThanOrEqual(4);
    expect(lut[120]).toBeGreaterThan(40);
    expect(lut[120]).toBeLessThan(215);
  });

  it('keeps a full-range, balanced image close to the original', () => {
    const px = image(256, 4, (x) => x);
    const lut = autoToneCurve(px, 256, whole(256, 4));
    expect(lut[0]).toBe(0);
    expect(lut[255]).toBe(255);
    expect(Math.abs(lut[128]! - 128)).toBeLessThan(20);
  });

  it('lifts the midtones of a dark image', () => {
    const px = image(64, 64, (x, y) => ((x + y) % 64 < 56 ? 20 + ((x * 3) % 40) : 255));
    const lut = autoToneCurve(px, 64, whole(64, 64));
    expect(lut[60]).toBeGreaterThan(60);
  });

  it('measures only the placed image, not the letterbox', () => {
    // Left half black letterbox, right half the image (values 100..200).
    const px = image(64, 8, (x) => (x < 32 ? 0 : 100 + Math.round(((x - 32) / 31) * 100)));
    const lut = autoToneCurve(px, 64, { x: 32, y: 0, w: 32, h: 8 });
    expect(lut[100]).toBeLessThan(10);
    expect(lut[200]).toBeGreaterThan(245);
  });

  it('composes curves in order', () => {
    const inner = new Uint8Array(256).map((_, i) => Math.min(255, i * 2));
    const outer = toneCurve(0, 0, true);
    const c = composeLut(outer, inner);
    expect(c[10]).toBe(255 - 20);
  });
});
