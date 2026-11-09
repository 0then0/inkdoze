import { encodeBmp } from '../formats/bmp.ts';
import { encodePxc } from '../formats/pxc.ts';
import type { OutputFormat } from '../catalog/types.ts';
import { layout } from './geometry.ts';
import { applyTone, flattenAlpha, luma, parseHexColor, quantizeGray, toneCurve } from './tone.ts';
import type { RenderJob, Size } from './types.ts';

export interface Rendered {
  width: number;
  height: number;
  /** Opaque RGBA after background, tone and palette processing. */
  rgba: Uint8ClampedArray;
  /** Grayscale plane when the job is grayscale. */
  gray: Uint8Array | null;
  canvas: OffscreenCanvas;
}

function context(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas is not available');
  return ctx;
}

/**
 * Single rendering path for preview and export. Geometry is done by the canvas
 * (drawImage with a matrix from geometry.ts, clipped to the crop's destination);
 * background flattening, tone and quantization run in plain TypeScript.
 */
export function renderPixels(source: CanvasImageSource, sourceSize: Size, job: RenderJob): Rendered {
  const { width, height } = job.target;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = context(canvas);
  const l = layout(sourceSize, job.target, job);
  if (l.clip.w > 0 && l.clip.h > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(l.clip.x, l.clip.y, l.clip.w, l.clip.h);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.setTransform(...l.matrix);
    ctx.drawImage(source, 0, 0);
    ctx.restore();
  }
  const image = ctx.getImageData(0, 0, width, height);
  const rgba = image.data;
  flattenAlpha(rgba, parseHexColor(job.background));
  const lut = toneCurve(job.brightness, job.contrast, job.invert);
  const gray = applyTone(rgba, lut, job.colorMode === 'grayscale');
  if (gray) {
    quantizeGray(gray, width, height, job.levels, job.dither);
    for (let i = 0, p = 0; p < gray.length; i += 4, p++) {
      const v = gray[p]!;
      rgba[i] = v;
      rgba[i + 1] = v;
      rgba[i + 2] = v;
      rgba[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return { width, height, rgba, gray, canvas };
}

function grayFrom(r: Rendered): Uint8Array {
  if (r.gray) return r.gray;
  const g = new Uint8Array(r.width * r.height);
  for (let i = 0, p = 0; p < g.length; i += 4, p++) g[p] = luma(r.rgba[i]!, r.rgba[i + 1]!, r.rgba[i + 2]!);
  return g;
}

export async function encodeRendered(r: Rendered, format: OutputFormat, jpegQuality: number): Promise<Blob> {
  switch (format) {
    case 'png':
      return r.canvas.convertToBlob({ type: 'image/png' });
    case 'jpeg':
      return r.canvas.convertToBlob({ type: 'image/jpeg', quality: Math.min(1, Math.max(0.3, jpegQuality)) });
    case 'bmp24':
      return new Blob([encodeBmp(r.width, r.height, 24, { rgba: r.rgba }) as BlobPart], { type: 'image/bmp' });
    case 'bmp8':
      return new Blob([encodeBmp(r.width, r.height, 8, { gray: grayFrom(r) }) as BlobPart], { type: 'image/bmp' });
    case 'bmp4':
      return new Blob([encodeBmp(r.width, r.height, 4, { gray: grayFrom(r) }) as BlobPart], { type: 'image/bmp' });
    case 'bmp2':
      return new Blob([encodeBmp(r.width, r.height, 2, { gray: grayFrom(r) }) as BlobPart], { type: 'image/bmp' });
    case 'bmp1':
      return new Blob([encodeBmp(r.width, r.height, 1, { gray: grayFrom(r) }) as BlobPart], { type: 'image/bmp' });
    case 'pxc':
      return new Blob([encodePxc(r.width, r.height, grayFrom(r)) as BlobPart], { type: 'application/octet-stream' });
  }
}
