import { DEVICES } from './devices.ts';
import { brandsByPopularity, byPopularity, popularity } from './popularity.ts';
import { INSTALL_METHODS, getInstallMethod } from './install.ts';
import { BRANDS, type Brand, type Device, type InstallMethod, type InstallStatus, type OutputFormat } from './types.ts';

export { DEVICES, INSTALL_METHODS, BRANDS, getInstallMethod, popularity, byPopularity, brandsByPopularity };
export type { Brand, Device, InstallMethod, InstallStatus, OutputFormat };

const BY_ID = new Map(DEVICES.map((d) => [d.id, d]));

export function getDevice(id: string): Device | undefined {
  return BY_ID.get(id);
}

export function deviceMethods(device: Device): InstallMethod[] {
  return device.install.map((id) => getInstallMethod(id)).filter((m): m is InstallMethod => !!m);
}

const STATUS_RANK: Record<InstallStatus, number> = {
  'custom-image': 0,
  'third-party': 1,
  'cover-only': 2,
  'size-only': 3,
};

/** Best available status for a device; size-only when no method is documented. */
export function deviceStatus(device: Device): InstallStatus {
  const methods = deviceMethods(device);
  if (methods.length === 0) return 'size-only';
  return methods.map((m) => m.status).sort((a, b) => STATUS_RANK[a] - STATUS_RANK[b])[0] ?? 'size-only';
}

export function normalize(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[×]/g, 'x')
    .replace(/[^\p{L}\p{N}.]+/gu, ' ')
    .trim();
}

function haystack(d: Device): string {
  const { width: w, height: h } = d.resolution;
  return normalize(
    [d.brand, d.model, d.generation, String(d.year), ...d.aliases, `${w}x${h}`, `${h}x${w}`, String(w), String(h), d.id.replace(/-/g, ' ')].join(' '),
  );
}

const HAYSTACKS = new Map(DEVICES.map((d) => [d.id, haystack(d)]));
const WORDS = new Map([...HAYSTACKS].map(([id, hay]) => [id, new Set(hay.split(' '))]));

/** Numbers match whole words only, so "volta 5" does not match "758 × 1024"; text matches anywhere. */
function matches(id: string, hay: string, token: string): boolean {
  if (/^\d+$/.test(token)) return (WORDS.get(id) ?? new Set(hay.split(' '))).has(token);
  return hay.includes(token);
}

/** Brands ordered by their most popular model, for the brand filter. */
export const BRANDS_BY_POPULARITY = brandsByPopularity(DEVICES);

export interface DeviceFilter {
  query?: string;
  brands?: readonly Brand[];
  color?: 'any' | 'color' | 'grayscale';
}

export function searchDevices(filter: DeviceFilter, devices: readonly Device[] = DEVICES): Device[] {
  const tokens = normalize(filter.query ?? '')
    .split(' ')
    .filter(Boolean);
  return devices.filter((d) => {
    if (filter.brands && filter.brands.length > 0 && !filter.brands.includes(d.brand)) return false;
    if (filter.color === 'color' && !d.color) return false;
    if (filter.color === 'grayscale' && d.color) return false;
    if (tokens.length === 0) return true;
    const hay = HAYSTACKS.get(d.id) ?? haystack(d);
    return tokens.every((t) => matches(d.id, hay, t));
  }).sort(byPopularity);
}

/** Other catalog devices with the exact same native resolution. */
export function sameResolution(device: Device): Device[] {
  const { width, height } = device.resolution;
  return DEVICES.filter((d) => d.id !== device.id && d.resolution.width === width && d.resolution.height === height);
}
