import type { Device, OutputFormat } from '../catalog/types.ts';
import { effectiveTone } from '../formats/registry.ts';
import { LIMITS } from '../io/limits.ts';
import { originalTarget } from './geometry.ts';
import type { Adjustments, OutputSettings, RenderJob, Size } from './types.ts';

export type JobResult = { ok: true; job: RenderJob } | { ok: false; error: 'outputTooLarge' };

export function clampDimension(v: number): number {
  if (!Number.isFinite(v)) return 1;
  return Math.max(1, Math.min(LIMITS.maxOutputSide, Math.round(v)));
}

export function targetSize(source: Size, settings: OutputSettings, adjust: Adjustments, device: Device | undefined): Size {
  if (settings.target === 'device' && device) return { ...device.resolution };
  if (settings.target === 'custom') return { width: settings.customWidth, height: settings.customHeight };
  return originalTarget(source, adjust.rotation, adjust.crop);
}

/** Merge settings, framing and format into the job that preview and export both render. */
export function buildJob(
  source: Size,
  settings: OutputSettings,
  adjust: Adjustments,
  device: Device | undefined,
  format: OutputFormat,
): JobResult {
  const target = targetSize(source, settings, adjust, device);
  if (
    !Number.isInteger(target.width) ||
    !Number.isInteger(target.height) ||
    target.width < 1 ||
    target.height < 1 ||
    Math.max(target.width, target.height) > LIMITS.maxOutputSide ||
    target.width * target.height > LIMITS.maxOutputPixels
  ) {
    return { ok: false, error: 'outputTooLarge' };
  }
  const tone = effectiveTone(format, settings.colorMode, settings.levels);
  return {
    ok: true,
    job: {
      target,
      rotation: adjust.rotation,
      crop: adjust.crop,
      fit: settings.fit,
      zoom: adjust.zoom,
      offsetX: adjust.offsetX,
      offsetY: adjust.offsetY,
      background: settings.background,
      colorMode: tone.colorMode,
      brightness: settings.brightness,
      contrast: settings.contrast,
      invert: settings.invert,
      levels: tone.levels,
      dither: tone.levels < 256 ? settings.dither : 'none',
    },
  };
}
