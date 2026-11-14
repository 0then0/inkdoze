import type { MessageKey } from '../i18n/keys.ts';

export const BRANDS = [
  'Kindle',
  'Kobo',
  'BOOX',
  'PocketBook',
  'Xteink',
  'tolino',
  'NOOK',
  'Bigme',
  'Meebook',
  'Supernote',
  'reMarkable',
  'DuRoBo',
  'Viwoods',
  'Sony',
  'Bookeen',
  'Likebook',
  'Boyue',
  'BQ',
  'Icarus',
  'iRex',
  'iriver',
  'Hanlin',
  'Hanvon',
  'Ectaco',
  'MobiScribe',
  'NUUT',
  'Oaxis',
  'txtr',
  'Foxit',
  'Spring Design',
  'Asus',
  'COOL-ER',
  'Booq',
  'EGriver',
  'Imcosys',
] as const;

export type Brand = (typeof BRANDS)[number];

/**
 * How trustworthy the cited source is for a given fact.
 * - manufacturer: the maker's own spec page, datasheet, manual or help center.
 * - firmware: source code of the stock or third-party firmware / SDK that drives the panel.
 * - community: established community tooling whose values come from real devices (KOReader, KCC).
 * - secondary: retailers, reviews or comparison sites only. Shown with a warning in the UI.
 */
export type SourceKind = 'manufacturer' | 'firmware' | 'community' | 'secondary';

export interface Source {
  kind: SourceKind;
  title: string;
  url: string;
  /** Optional note on what exactly the source states. Not shown verbatim to users. */
  note?: string;
}

export interface Resolution {
  /** Native panel width in portrait orientation (width < height). */
  width: number;
  height: number;
}

/**
 * Installation status, deliberately separate from the screen size.
 * - custom-image: the firmware/app can show a user-supplied image.
 * - cover-only: only the current book cover can be shown on the sleep screen.
 * - third-party: requires a specific third-party firmware, jailbreak or app.
 * - size-only: only the screen size is confirmed; no documented install path.
 */
export type InstallStatus = 'custom-image' | 'cover-only' | 'third-party' | 'size-only';

/** Output formats InkDoze can write. BMP variants are listed by bit depth. */
export type OutputFormat = 'png' | 'jpeg' | 'bmp24' | 'bmp8' | 'bmp4' | 'bmp2' | 'bmp1' | 'pxc';

export interface InstallStep {
  key: MessageKey;
  /** Literal values (paths, file names, menu labels as shown on device) inserted into the text. */
  params?: Record<string, string>;
}

export interface InstallMethod {
  id: string;
  status: InstallStatus;
  /** Firmware or software this method applies to, e.g. "CrossPoint 2.0.0+". Shown as-is. */
  software: string;
  /** True when the only sources are community documentation rather than the vendor or project. */
  communityDocumented: boolean;
  /** Formats confirmed by the sources for this method. Empty for cover-only and size-only. */
  formats: OutputFormat[];
  recommendedFormat?: OutputFormat;
  /** Suggested file name without extension, if the method requires one (e.g. "sleep"). */
  fileName?: string;
  /**
   * Offer an EPUB whose cover is the prepared image, for firmware that only shows the
   * cover of the open book. The user sends the book to the device themselves.
   */
  coverEpub?: boolean;
  steps: InstallStep[];
  limitations: InstallStep[];
  sources: Source[];
  verified: string;
}

export interface Device {
  /** Stable, URL-safe ID. Never reuse or rename once published. */
  id: string;
  brand: Brand;
  model: string;
  /** Generation / release label, e.g. "11th generation (2021)". */
  generation: string;
  /** Numbered generation (e.g. 11 for "11th generation"); the UI localizes it. */
  ordinal?: number;
  /** Release year used for sorting and filtering. */
  year: number;
  aliases: string[];
  resolution: Resolution;
  color: boolean;
  /** Sources for the resolution and colour capability. */
  sources: Source[];
  /** ISO date (YYYY-MM-DD) when the resolution was last checked against the sources. */
  verified: string;
  /** IDs of install methods that apply to this exact model. */
  install: string[];
  /** Optional user-facing note keys, e.g. disagreement between marketing and firmware. */
  notes?: InstallStep[];
}
