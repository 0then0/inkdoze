import { DEVICES } from './devices.ts';
import { INSTALL_METHODS, getInstallMethod } from './install.ts';
import { BRANDS, type Brand, type Device, type InstallMethod, type InstallStatus, type OutputFormat } from './types.ts';

export { DEVICES, INSTALL_METHODS, BRANDS, getInstallMethod };
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
    .replace(/[^a-z0-9.]+/g, ' ')
    .trim();
}

function haystack(d: Device): string {
  const { width: w, height: h } = d.resolution;
  return normalize(
    [d.brand, d.model, d.generation, String(d.year), ...d.aliases, `${w}x${h}`, `${h}x${w}`, d.id.replace(/-/g, ' ')].join(' '),
  );
}

const HAYSTACKS = new Map(DEVICES.map((d) => [d.id, haystack(d)]));

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
    return tokens.every((t) => hay.includes(t));
  });
}

/** Devices grouped by brand in catalog order, newest generation first. */
export function groupByBrand(devices: readonly Device[]): Array<[Brand, Device[]]> {
  const groups = new Map<Brand, Device[]>();
  for (const b of BRANDS) groups.set(b, []);
  for (const d of devices) groups.get(d.brand)?.push(d);
  return [...groups.entries()]
    .filter(([, list]) => list.length > 0)
    .map(([b, list]) => [b, [...list].sort((x, y) => y.year - x.year || x.model.localeCompare(y.model))]);
}

/** Other catalog devices with the exact same native resolution. */
export function sameResolution(device: Device): Device[] {
  const { width, height } = device.resolution;
  return DEVICES.filter((d) => d.id !== device.id && d.resolution.width === width && d.resolution.height === height);
}
