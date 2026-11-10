import { BRANDS, type Device, type InstallMethod, type OutputFormat } from './types.ts';

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FORMATS: readonly OutputFormat[] = ['png', 'jpeg', 'bmp24', 'bmp8', 'bmp4', 'bmp2', 'bmp1', 'pxc'];
/** Keep in sync with the decoded-pixel limit in src/io/limits.ts. */
const MAX_SIDE = 8192;

export interface CatalogIssue {
  id: string;
  message: string;
}

function checkUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Latest acceptable verification date: today plus one day, so time zones ahead of UTC pass. */
function latestDate(today: string): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function checkDate(date: string, today: string): string | null {
  if (!DATE_RE.test(date)) return `verified date "${date}" is not YYYY-MM-DD`;
  if (Number.isNaN(Date.parse(date))) return `verified date "${date}" is invalid`;
  if (date > latestDate(today)) return `verified date "${date}" is in the future`;
  return null;
}

export function validateCatalog(
  devices: readonly Device[],
  methods: Readonly<Record<string, InstallMethod>>,
  hasMessage: (key: string) => boolean,
  today = new Date().toISOString().slice(0, 10),
): CatalogIssue[] {
  const issues: CatalogIssue[] = [];
  const add = (id: string, message: string) => issues.push({ id, message });

  // Install methods
  for (const [key, m] of Object.entries(methods)) {
    if (m.id !== key) add(key, `method id "${m.id}" does not match its key`);
    if (!m.software.trim()) add(key, 'method has no software label');
    if (!hasMessage(`method.${key}`)) add(key, `missing message key method.${key}`);
    if (m.sources.length === 0) add(key, 'method has no sources');
    for (const s of m.sources) if (!checkUrl(s.url)) add(key, `source URL is not https: ${s.url}`);
    const dateIssue = checkDate(m.verified, today);
    if (dateIssue) add(key, dateIssue);
    for (const f of m.formats) if (!FORMATS.includes(f)) add(key, `unknown format ${f}`);
    if (new Set(m.formats).size !== m.formats.length) add(key, 'duplicate formats');
    const needsFile = m.status === 'custom-image' || m.status === 'third-party';
    if (needsFile && !m.recommendedFormat) add(key, `${m.status} method needs a recommended format`);
    if (!needsFile && (m.formats.length > 0 || m.recommendedFormat)) add(key, `${m.status} method must not list formats`);
    if (m.recommendedFormat && m.formats.length > 0 && !m.formats.includes(m.recommendedFormat)) {
      add(key, 'recommended format is not among confirmed formats');
    }
    if (m.status !== 'size-only' && m.steps.length === 0) add(key, 'method has no steps');
    for (const step of [...m.steps, ...m.limitations]) {
      if (!hasMessage(step.key)) add(key, `missing message key ${step.key}`);
    }
  }

  // Devices
  const ids = new Set<string>();
  const names = new Map<string, string>();
  const aliases = new Map<string, string>();
  for (const d of devices) {
    const id = d.id || '(empty id)';
    if (!ID_RE.test(d.id)) add(id, 'id must be lowercase kebab-case');
    if (ids.has(d.id)) add(id, 'duplicate id');
    ids.add(d.id);
    if (!(BRANDS as readonly string[]).includes(d.brand)) add(id, `unknown brand ${d.brand}`);
    if (!d.model.trim()) add(id, 'missing model');
    if (!d.generation.trim()) add(id, 'missing generation');
    if (!Number.isInteger(d.year) || d.year < 1998 || d.year > Number(today.slice(0, 4)) + 1) add(id, `implausible year ${d.year}`);

    const nameKey = `${d.brand}|${d.model}|${d.generation}`.toLowerCase();
    const existing = names.get(nameKey);
    if (existing) add(id, `duplicate brand/model/generation of ${existing}`);
    names.set(nameKey, d.id);

    for (const alias of d.aliases) {
      const a = alias.trim().toLowerCase();
      if (!a) add(id, 'empty alias');
      const owner = aliases.get(a);
      if (owner && owner !== d.id) add(id, `alias "${alias}" also used by ${owner}`);
      aliases.set(a, d.id);
    }

    const { width, height } = d.resolution;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
      add(id, 'resolution must be positive integers');
    } else {
      if (width >= height) add(id, `resolution must be portrait (width < height), got ${width}x${height}`);
      if (height > MAX_SIDE) add(id, `resolution exceeds ${MAX_SIDE}px`);
    }
    if (typeof d.color !== 'boolean') add(id, 'color must be boolean');

    if (d.sources.length === 0) add(id, 'device has no sources');
    for (const s of d.sources) {
      if (!checkUrl(s.url)) add(id, `source URL is not https: ${s.url}`);
      if (!s.title.trim()) add(id, 'source without title');
    }
    const dateIssue = checkDate(d.verified, today);
    if (dateIssue) add(id, dateIssue);

    if (new Set(d.install).size !== d.install.length) add(id, 'duplicate install method');
    for (const mid of d.install) {
      const m = methods[mid];
      if (!m) {
        add(id, `unknown install method ${mid}`);
        continue;
      }
      if (m.fileName === 'sleep' && height > 3072) add(id, 'resolution exceeds CrossPoint BMP limit');
    }
    for (const n of d.notes ?? []) if (!hasMessage(n.key)) add(id, `missing message key ${n.key}`);
  }
  return issues;
}
