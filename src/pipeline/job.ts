import type { Device, OutputFormat } from '../catalog/types.ts';
import { effectiveTone } from '../formats/registry.ts';
import { LIMITS } from '../io/limits.ts';
import { originalTarget } from './geometry.ts';
import { DEFAULT_SETTINGS, type Adjustments, type OutputSettings, type RenderJob, type Size } from './types.ts';

export type JobResult = { ok: true; job: RenderJob } | { ok: false; error: 'outputTooLarge' | 'overlayDeviceRequired' };

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
  preserveAlpha = false,
): JobResult {
  if (preserveAlpha && !device) return { ok: false, error: 'overlayDeviceRequired' };
  const target = preserveAlpha && device ? { ...device.resolution } : targetSize(source, settings, adjust, device);
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
  const geometry = { target, ...adjust, fit: settings.fit };
  if (preserveAlpha) {
    return {
      ok: true,
      job: {
        ...geometry,
        preserveAlpha: true,
        background: DEFAULT_SETTINGS.background,
        colorMode: 'color',
        autoTone: false,
        brightness: 0,
        contrast: 0,
        invert: false,
        levels: 256,
        dither: 'none',
      },
    };
  }
  const colorMode = settings.colorMode === 'auto' ? (device?.color ? 'color' : 'grayscale') : settings.colorMode;
  const tone = effectiveTone(format, colorMode, settings.levels);
  return {
    ok: true,
    job: {
      ...geometry,
      background: settings.background,
      colorMode: tone.colorMode,
      autoTone: settings.autoTone,
      brightness: settings.brightness,
      contrast: settings.contrast,
      invert: settings.invert,
      levels: tone.levels,
      dither: tone.levels < 256 ? settings.dither : 'none',
    },
  };
}
