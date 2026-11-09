import type { FitMode, NormRect, PxRect, Rotation, Size } from './types.ts';

/** 2D affine matrix in canvas order: x' = a*x + c*y + e, y' = b*x + d*y + f. */
export type Matrix = [a: number, b: number, c: number, d: number, e: number, f: number];

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 8;
export const MIN_CROP = 0.02;

export function rotatedSize(src: Size, rotation: Rotation): Size {
  return rotation === 90 || rotation === 270 ? { width: src.height, height: src.width } : { ...src };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Keep a normalized crop rect inside the image and above the minimum size. */
export function clampCrop(rect: NormRect): NormRect {
  const w = clamp(rect.w, MIN_CROP, 1);
  const h = clamp(rect.h, MIN_CROP, 1);
  return { x: clamp(rect.x, 0, 1 - w), y: clamp(rect.y, 0, 1 - h), w, h };
}

/**
 * Largest rect with the given pixel aspect ratio (width / height) that fits inside
 * `rect`, centred on it. Works in normalized units of an image with size `space`.
 */
export function fitCropToAspect(rect: NormRect, space: Size, aspect: number): NormRect {
  const pw = rect.w * space.width;
  const ph = rect.h * space.height;
  let w = pw;
  let h = pw / aspect;
  if (h > ph) {
    h = ph;
    w = ph * aspect;
  }
  const nw = w / space.width;
  const nh = h / space.height;
  return clampCrop({ x: rect.x + (rect.w - nw) / 2, y: rect.y + (rect.h - nh) / 2, w: nw, h: nh });
}

/** Crop rectangle in rotated-space pixels. A null crop is the whole image. */
export function cropPixels(rotated: Size, crop: NormRect | null): PxRect {
  if (!crop) return { x: 0, y: 0, w: rotated.width, h: rotated.height };
  const c = clampCrop(crop);
  return { x: c.x * rotated.width, y: c.y * rotated.height, w: c.w * rotated.width, h: c.h * rotated.height };
}

/** Output size when the target is the original image (after rotation and crop). */
export function originalTarget(src: Size, rotation: Rotation, crop: NormRect | null): Size {
  const c = cropPixels(rotatedSize(src, rotation), crop);
  return { width: Math.max(1, Math.round(c.w)), height: Math.max(1, Math.round(c.h)) };
}

/**
 * Where the crop region lands in the target, in target pixels.
 * - fit: whole crop visible, letterboxed with the background.
 * - fill: target fully covered, overflow cut off.
 * - stretch: crop scaled independently on each axis to the target.
 * `zoom` multiplies the scale; offsets in [-1, 1] slide the region from the
 * left/top edge (-1) through centred (0) to the right/bottom edge (1).
 */
export function placement(crop: PxRect, target: Size, fit: FitMode, zoom = 1, offsetX = 0, offsetY = 0): PxRect {
  const z = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
  let sx: number;
  let sy: number;
  if (fit === 'stretch') {
    sx = (target.width / crop.w) * z;
    sy = (target.height / crop.h) * z;
  } else {
    const s = fit === 'fit' ? Math.min(target.width / crop.w, target.height / crop.h) : Math.max(target.width / crop.w, target.height / crop.h);
    sx = s * z;
    sy = s * z;
  }
  const w = crop.w * sx;
  const h = crop.h * sy;
  const ox = clamp(offsetX, -1, 1);
  const oy = clamp(offsetY, -1, 1);
  return { x: ((target.width - w) * (1 + ox)) / 2, y: ((target.height - h) * (1 + oy)) / 2, w, h };
}

/** Matrix that maps source image pixels into rotated space (clockwise rotation). */
export function rotationMatrix(src: Size, rotation: Rotation): Matrix {
  switch (rotation) {
    case 90:
      return [0, 1, -1, 0, src.height, 0];
    case 180:
      return [-1, 0, 0, -1, src.width, src.height];
    case 270:
      return [0, -1, 1, 0, 0, src.width];
    default:
      return [1, 0, 0, 1, 0, 0];
  }
}

/** Full source → target transform: rotate, move crop origin to 0, scale, place. */
export function sourceToTarget(src: Size, rotation: Rotation, crop: PxRect, dest: PxRect): Matrix {
  const [a, b, c, d, e, f] = rotationMatrix(src, rotation);
  const sx = dest.w / crop.w;
  const sy = dest.h / crop.h;
  return [sx * a, sy * b, sx * c, sy * d, sx * (e - crop.x) + dest.x, sy * (f - crop.y) + dest.y];
}

export function applyMatrix(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** Visible part of `dest` inside the target canvas. The renderer clips to it. */
export function clipRect(dest: PxRect, target: Size): PxRect {
  const x0 = Math.max(0, dest.x);
  const y0 = Math.max(0, dest.y);
  const x1 = Math.min(target.width, dest.x + dest.w);
  const y1 = Math.min(target.height, dest.y + dest.h);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

export interface Layout {
  rotated: Size;
  crop: PxRect;
  dest: PxRect;
  clip: PxRect;
  matrix: Matrix;
}

export function layout(
  src: Size,
  target: Size,
  opts: { rotation: Rotation; crop: NormRect | null; fit: FitMode; zoom: number; offsetX: number; offsetY: number },
): Layout {
  const rotated = rotatedSize(src, opts.rotation);
  const crop = cropPixels(rotated, opts.crop);
  const dest = placement(crop, target, opts.fit, opts.zoom, opts.offsetX, opts.offsetY);
  return { rotated, crop, dest, clip: clipRect(dest, target), matrix: sourceToTarget(src, opts.rotation, crop, dest) };
}
