import type { InstallMethod, OutputFormat } from '../catalog/types.ts';
import type { ColorMode, FormatChoice, Levels } from '../pipeline/types.ts';

export interface FormatInfo {
  id: OutputFormat;
  extension: string;
  mime: string;
  /** Maximum number of gray levels the format can store; 256 means unrestricted. */
  maxLevels: Levels;
  /** Grayscale-only formats force the grayscale pipeline. */
  grayscaleOnly: boolean;
  /** Offered in the format menu. PXC stays hidden until a released firmware reads it. */
  selectable: boolean;
}

export const FORMATS: Record<OutputFormat, FormatInfo> = {
  png: { id: 'png', extension: 'png', mime: 'image/png', maxLevels: 256, grayscaleOnly: false, selectable: true },
  jpeg: { id: 'jpeg', extension: 'jpg', mime: 'image/jpeg', maxLevels: 256, grayscaleOnly: false, selectable: true },
  bmp24: { id: 'bmp24', extension: 'bmp', mime: 'image/bmp', maxLevels: 256, grayscaleOnly: false, selectable: true },
  bmp8: { id: 'bmp8', extension: 'bmp', mime: 'image/bmp', maxLevels: 256, grayscaleOnly: true, selectable: true },
  bmp4: { id: 'bmp4', extension: 'bmp', mime: 'image/bmp', maxLevels: 16, grayscaleOnly: true, selectable: true },
  bmp2: { id: 'bmp2', extension: 'bmp', mime: 'image/bmp', maxLevels: 4, grayscaleOnly: true, selectable: true },
  bmp1: { id: 'bmp1', extension: 'bmp', mime: 'image/bmp', maxLevels: 2, grayscaleOnly: true, selectable: true },
  pxc: { id: 'pxc', extension: 'pxc', mime: 'application/octet-stream', maxLevels: 4, grayscaleOnly: true, selectable: false },
};

export const FORMAT_ORDER: OutputFormat[] = ['png', 'jpeg', 'bmp24', 'bmp8', 'bmp4', 'bmp2', 'bmp1', 'pxc'];

/** Formats shown in the menu: always the common ones, plus anything the method confirms. */
export function selectableFormats(method: InstallMethod | undefined): OutputFormat[] {
  return FORMAT_ORDER.filter((f) => FORMATS[f].selectable || (method?.formats.includes(f) ?? false));
}

export function resolveFormat(choice: FormatChoice, method: InstallMethod | undefined): OutputFormat {
  if (choice !== 'auto') return choice;
  return method?.recommendedFormat ?? 'png';
}

/** Levels and colour mode actually used, given the chosen format's capacity. */
export function effectiveTone(format: OutputFormat, colorMode: ColorMode, levels: Levels): { colorMode: ColorMode; levels: Levels } {
  const info = FORMATS[format];
  const mode: ColorMode = info.grayscaleOnly ? 'grayscale' : colorMode;
  if (mode === 'color') return { colorMode: 'color', levels: 256 };
  return { colorMode: 'grayscale', levels: Math.min(levels, info.maxLevels) as Levels };
}
