import type { Dither, Levels } from './types.ts';

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function parseHexColor(hex: string): Rgb {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || !m[1]) return { r: 255, g: 255, b: 255 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * Composite RGBA (straight alpha) over an opaque background, in place.
 * Every pixel ends up fully opaque, so transparent regions become the background.
 */
export function flattenAlpha(rgba: Uint8ClampedArray, bg: Rgb): void {
  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3]!;
    if (a === 255) continue;
    if (a === 0) {
      rgba[i] = bg.r;
      rgba[i + 1] = bg.g;
      rgba[i + 2] = bg.b;
    } else {
      const t = a / 255;
      rgba[i] = Math.round(rgba[i]! * t + bg.r * (1 - t));
      rgba[i + 1] = Math.round(rgba[i + 1]! * t + bg.g * (1 - t));
      rgba[i + 2] = Math.round(rgba[i + 2]! * t + bg.b * (1 - t));
    }
    rgba[i + 3] = 255;
  }
}

export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Automatic tone curve for e-ink, computed from the image's own luminance:
 * 1. levels: the darkest and brightest 0.5 % are clipped and the rest stretched to
 *    the full range (gain capped so flat images are not blown out);
 * 2. midtones: a gamma pulls the mean brightness halfway towards slightly above
 *    middle gray, because e-ink panels render midtones darker than screens.
 * Only pixels inside `region` (the placed image, not the letterbox) are measured.
 */
export function autoToneCurve(rgba: Uint8ClampedArray, width: number, region: Region): Uint8Array {
  const hist = new Uint32Array(256);
  const x0 = Math.max(0, Math.floor(region.x));
  const y0 = Math.max(0, Math.floor(region.y));
  const x1 = Math.min(width, Math.ceil(region.x + region.w));
  const y1 = Math.min(rgba.length / 4 / width, Math.ceil(region.y + region.h));
  // Sample at most ~250k pixels; plenty for a histogram.
  const step = Math.max(1, Math.floor(Math.sqrt(((x1 - x0) * (y1 - y0)) / 250_000)));
  let total = 0;
  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const i = (y * width + x) * 4;
      hist[luma(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!)]!++;
      total++;
    }
  }
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) lut[i] = i;
  if (total === 0) return lut;

  const percentile = (p: number) => {
    const target = total * p;
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[v]!;
      if (acc >= target) return v;
    }
    return 255;
  };
  let lo = percentile(0.005);
  let hi = percentile(0.995);
  const MAX_GAIN = 3;
  if (hi - lo < 255 / MAX_GAIN) {
    const mid = (lo + hi) / 2;
    lo = Math.max(0, mid - 255 / MAX_GAIN / 2);
    hi = Math.min(255, mid + 255 / MAX_GAIN / 2);
  }
  const span = Math.max(1, hi - lo);

  let sum = 0;
  for (let v = 0; v < 256; v++) sum += hist[v]! * Math.min(1, Math.max(0, (v - lo) / span));
  const mean = Math.min(0.98, Math.max(0.02, sum / total));
  const TARGET = 0.55;
  const fullGamma = Math.log(TARGET) / Math.log(mean);
  const gamma = Math.min(1.6, Math.max(0.6, Math.sqrt(fullGamma)));

  for (let v = 0; v < 256; v++) {
    const t = Math.min(1, Math.max(0, (v - lo) / span));
    lut[v] = Math.round(255 * Math.pow(t, gamma));
  }
  return lut;
}

/** LUT that applies `inner` first, then `outer`. */
export function composeLut(outer: Uint8Array, inner: Uint8Array): Uint8Array {
  const out = new Uint8Array(256);
  for (let i = 0; i < 256; i++) out[i] = outer[inner[i]!]!;
  return out;
}

/** BT.601 luma with the same integer weights CrossPoint uses (77/150/29 >> 8). */
export function luma(r: number, g: number, b: number): number {
  return (77 * r + 150 * g + 29 * b) >> 8;
}

/** Lookup table for brightness (-100..100), contrast (-100..100) and inversion. */
export function toneCurve(brightness: number, contrast: number, invert: boolean): Uint8Array {
  const lut = new Uint8Array(256);
  const c = Math.max(-100, Math.min(100, contrast)) * 2.55;
  const factor = (259 * (c + 255)) / (255 * (259 - c));
  const offset = Math.max(-100, Math.min(100, brightness)) * 2.55;
  for (let v = 0; v < 256; v++) {
    let out = factor * (v - 128) + 128 + offset;
    out = Math.max(0, Math.min(255, Math.round(out)));
    lut[v] = invert ? 255 - out : out;
  }
  return lut;
}

export function isIdentity(lut: Uint8Array): boolean {
  for (let i = 0; i < 256; i++) if (lut[i] !== i) return false;
  return true;
}

/** Apply the tone curve to colour channels and return a grayscale plane if requested. */
export function applyTone(rgba: Uint8ClampedArray, lut: Uint8Array, grayscale: boolean): Uint8Array | null {
  const identity = isIdentity(lut);
  if (grayscale) {
    const gray = new Uint8Array(rgba.length / 4);
    for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
      gray[p] = lut[luma(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!)]!;
    }
    return gray;
  }
  if (!identity) {
    for (let i = 0; i < rgba.length; i += 4) {
      rgba[i] = lut[rgba[i]!]!;
      rgba[i + 1] = lut[rgba[i + 1]!]!;
      rgba[i + 2] = lut[rgba[i + 2]!]!;
    }
  }
  return null;
}

/** Evenly spaced gray levels, e.g. 4 → [0, 85, 170, 255]. */
export function paletteFor(levels: Levels): number[] {
  const out: number[] = [];
  for (let i = 0; i < levels; i++) out.push(Math.round((i * 255) / (levels - 1)));
  return out;
}

/** Index of the nearest level for a value in 0..255. */
export function levelIndex(v: number, levels: Levels): number {
  const step = 255 / (levels - 1);
  return Math.max(0, Math.min(levels - 1, Math.round(v / step)));
}

/**
 * Quantize a grayscale plane to `levels` evenly spaced values, in place, with
 * optional error diffusion. Output values are exactly the palette values.
 */
export function quantizeGray(gray: Uint8Array, width: number, height: number, levels: Levels, dither: Dither): void {
  if (levels >= 256) return;
  const palette = paletteFor(levels);
  if (dither === 'none') {
    for (let i = 0; i < gray.length; i++) gray[i] = palette[levelIndex(gray[i]!, levels)]!;
    return;
  }
  // Error diffusion on a float copy. Two rows of padding avoid edge checks.
  const buf = new Float32Array(gray.length);
  for (let i = 0; i < gray.length; i++) buf[i] = gray[i]!;
  const push = (x: number, y: number, err: number) => {
    if (x < 0 || x >= width || y >= height) return;
    buf[y * width + x]! += err;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const old = Math.max(0, Math.min(255, buf[i]!));
      const q = palette[levelIndex(old, levels)]!;
      gray[i] = q;
      const err = old - q;
      if (err === 0) continue;
      if (dither === 'floyd-steinberg') {
        push(x + 1, y, (err * 7) / 16);
        push(x - 1, y + 1, (err * 3) / 16);
        push(x, y + 1, (err * 5) / 16);
        push(x + 1, y + 1, (err * 1) / 16);
      } else {
        const e = err / 8;
        push(x + 1, y, e);
        push(x + 2, y, e);
        push(x - 1, y + 1, e);
        push(x, y + 1, e);
        push(x + 1, y + 1, e);
        push(x, y + 2, e);
      }
    }
  }
}
