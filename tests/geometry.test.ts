import { describe, expect, it } from 'vitest';
import {
  applyMatrix,
  clipRect,
  cropPixels,
  fitCropToAspect,
  layout,
  originalTarget,
  placement,
  rotatedSize,
} from '../src/pipeline/geometry.ts';
import type { Rotation } from '../src/pipeline/types.ts';

const src = { width: 400, height: 200 };
const close = (a: [number, number], b: [number, number]) => {
  expect(a[0]).toBeCloseTo(b[0], 6);
  expect(a[1]).toBeCloseTo(b[1], 6);
};
const base = { crop: null, fit: 'stretch' as const, zoom: 1, offsetX: 0, offsetY: 0 };

describe('rotation', () => {
  it('swaps dimensions for quarter turns', () => {
    expect(rotatedSize(src, 90)).toEqual({ width: 200, height: 400 });
    expect(rotatedSize(src, 180)).toEqual(src);
    expect(rotatedSize(src, 270)).toEqual({ width: 200, height: 400 });
  });

  // Source top-left corner must land on the expected corner of the output.
  const cases: Array<[Rotation, [number, number], [number, number]]> = [
    [0, [0, 0], [400, 200]],
    [90, [200, 0], [0, 400]], // clockwise: top-left goes to top-right
    [180, [400, 200], [0, 0]],
    [270, [0, 400], [200, 0]],
  ];
  for (const [rotation, topLeft, bottomRight] of cases) {
    it(`maps corners for ${rotation}°`, () => {
      const target = rotatedSize(src, rotation);
      const l = layout(src, target, { ...base, rotation });
      close(applyMatrix(l.matrix, 0, 0), topLeft);
      close(applyMatrix(l.matrix, src.width, src.height), bottomRight);
    });
  }

  it('rotates a marker pixel clockwise by 90°', () => {
    // A point near the source's top edge, left side, ends near the right edge, top.
    const l = layout(src, { width: 200, height: 400 }, { ...base, rotation: 90 });
    const [x, y] = applyMatrix(l.matrix, 10, 5);
    expect(x).toBeCloseTo(195);
    expect(y).toBeCloseTo(10);
  });
});

describe('crop', () => {
  it('maps the crop region exactly onto the destination', () => {
    const crop = { x: 0.25, y: 0.5, w: 0.5, h: 0.5 };
    const l = layout(src, { width: 100, height: 50 }, { ...base, rotation: 0, crop });
    close(applyMatrix(l.matrix, 100, 100), [0, 0]);
    close(applyMatrix(l.matrix, 300, 200), [100, 50]);
  });

  it('applies the crop in rotated space', () => {
    // Rotated 90°: rotated image is 200×400. Crop the top half of the rotated image.
    const crop = { x: 0, y: 0, w: 1, h: 0.5 };
    const l = layout(src, { width: 200, height: 200 }, { ...base, rotation: 90, crop });
    // Rotated top half corresponds to the source's left half (x in 0..200).
    close(applyMatrix(l.matrix, 0, 200), [0, 0]); // source bottom-left → rotated top-left
    close(applyMatrix(l.matrix, 200, 0), [200, 200]); // source (200,0) → bottom-right of the crop
  });

  it('clamps invalid crops into the image', () => {
    expect(cropPixels({ width: 100, height: 100 }, { x: 0.9, y: -1, w: 0.5, h: 5 })).toEqual({ x: 50, y: 0, w: 50, h: 100 });
  });

  it('fits a crop to an aspect ratio inside the image', () => {
    const r = fitCropToAspect({ x: 0, y: 0, w: 1, h: 1 }, { width: 400, height: 200 }, 0.5);
    expect(r.w * 400 / (r.h * 200)).toBeCloseTo(0.5);
    expect(r.h).toBeCloseTo(1);
    expect(r.x).toBeCloseTo((1 - r.w) / 2);
  });

  it('uses the crop for the original-size target', () => {
    expect(originalTarget(src, 90, { x: 0, y: 0, w: 0.5, h: 0.25 })).toEqual({ width: 100, height: 100 });
  });
});

describe('placement', () => {
  const crop = { x: 0, y: 0, w: 400, h: 200 };
  const target = { width: 100, height: 100 };

  it('fit letterboxes and centres', () => {
    expect(placement(crop, target, 'fit')).toEqual({ x: 0, y: 25, w: 100, h: 50 });
  });

  it('fill covers the target and centres the overflow', () => {
    expect(placement(crop, target, 'fill')).toEqual({ x: -50, y: 0, w: 200, h: 100 });
  });

  it('stretch matches the target exactly', () => {
    expect(placement(crop, target, 'stretch')).toEqual({ x: 0, y: 0, w: 100, h: 100 });
  });

  it('offsets slide to the edges', () => {
    expect(placement(crop, target, 'fill', 1, -1, 0).x).toBeCloseTo(0);
    expect(placement(crop, target, 'fill', 1, 1, 0).x).toBe(-100);
    expect(placement(crop, target, 'fit', 1, 0, -1).y).toBe(0);
    expect(placement(crop, target, 'fit', 1, 0, 1).y).toBe(50);
  });

  it('zoom scales around the centre', () => {
    expect(placement(crop, target, 'fit', 2)).toEqual({ x: -50, y: 0, w: 200, h: 100 });
  });

  it('clips the destination to the canvas', () => {
    expect(clipRect({ x: -50, y: 25, w: 200, h: 50 }, target)).toEqual({ x: 0, y: 25, w: 100, h: 50 });
    expect(clipRect({ x: 200, y: 0, w: 10, h: 10 }, target).w).toBe(0);
  });

  it('keeps pixels outside the crop out of the fit letterbox', () => {
    // With a crop and fit mode the destination is smaller than the target; the
    // renderer clips to `clip`, so letterbox areas stay background.
    const l = layout(src, { width: 100, height: 100 }, { ...base, fit: 'fit', rotation: 0, crop: { x: 0.25, y: 0, w: 0.5, h: 1 } });
    expect(l.clip).toEqual({ x: 0, y: 0, w: 100, h: 100 });
    const l2 = layout(src, { width: 100, height: 100 }, { ...base, fit: 'fit', rotation: 0, crop: { x: 0, y: 0, w: 1, h: 1 } });
    expect(l2.clip).toEqual({ x: 0, y: 25, w: 100, h: 50 });
  });
});
