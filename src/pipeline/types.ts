import type { OutputFormat } from '../catalog/types.ts';

export type Rotation = 0 | 90 | 180 | 270;
export type FitMode = 'fit' | 'fill' | 'stretch';
export type TargetMode = 'device' | 'original' | 'custom';
export type ColorMode = 'grayscale' | 'color';
/** `auto` follows the selected e-reader: colour panels get colour, the rest grayscale. */
export type ColorChoice = 'auto' | ColorMode;
export type Levels = 256 | 16 | 4 | 2;
export type Dither = 'none' | 'floyd-steinberg' | 'atkinson';
export type FormatChoice = OutputFormat | 'auto';

export interface Size {
  width: number;
  height: number;
}

/** Rectangle normalized to 0..1 in the rotated source space. */
export interface NormRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Rectangle in pixels. */
export interface PxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Output settings that can be set for the whole batch or overridden per file. */
export interface OutputSettings {
  target: TargetMode;
  customWidth: number;
  customHeight: number;
  fit: FitMode;
  background: string;
  colorMode: ColorChoice;
  /** Stretch the tonal range and balance midtones per image for e-ink. */
  autoTone: boolean;
  brightness: number;
  contrast: number;
  invert: boolean;
  levels: Levels;
  dither: Dither;
  format: FormatChoice;
  jpegQuality: number;
}

/** Per-image framing adjustments. Always specific to one file. */
export interface Adjustments {
  rotation: Rotation;
  crop: NormRect | null;
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export const DEFAULT_SETTINGS: OutputSettings = {
  target: 'device',
  customWidth: 1072,
  customHeight: 1448,
  fit: 'fill',
  background: '#ffffff',
  colorMode: 'auto',
  autoTone: true,
  brightness: 0,
  contrast: 0,
  invert: false,
  levels: 256,
  dither: 'none',
  format: 'auto',
  jpegQuality: 0.92,
};

export const DEFAULT_ADJUST: Adjustments = {
  rotation: 0,
  crop: null,
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
};

/** Everything the renderer needs. Resolved on the main thread so preview and export share it. */
export interface RenderJob {
  target: Size;
  rotation: Rotation;
  crop: NormRect | null;
  fit: FitMode;
  zoom: number;
  offsetX: number;
  offsetY: number;
  background: string;
  colorMode: ColorMode;
  autoTone: boolean;
  brightness: number;
  contrast: number;
  invert: boolean;
  levels: Levels;
  dither: Dither;
}
