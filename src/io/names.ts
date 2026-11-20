const MAX_BASE = 100;
const OVERLAY_PNG_EXTENSION = '.png';
// CrossPoint 2.0.0 reads each sleep filename into a 256-byte, null-terminated buffer.
const CROSSPOINT_MAX_FILENAME_BYTES = 255;
const OVERLAY_RESERVED_STEM = /^(con|prn|aux|nul|conin\$|conout\$|com[1-9¹²³]|lpt[1-9¹²³])$/i;

/** Turn user input or an original file name into a safe base name without extension. */
export function sanitizeBaseName(input: string, fallback = 'image'): string {
  const cleaned = input
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.-]+|[\s.]+$/g, '')
    .slice(0, MAX_BASE)
    .trim();
  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
  if (!cleaned || reserved.test(cleaned)) return fallback;
  return cleaned;
}

export function stripExtension(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(0, i) : name;
}

/** Make names unique within a batch by appending -2, -3, … (case-insensitive). */
export function uniqueNames(names: string[], key = (name: string) => name.toLowerCase()): string[] {
  const used = new Set<string>();
  return names.map((name) => {
    const dot = name.lastIndexOf('.');
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    let candidate = name;
    for (let i = 2; used.has(key(candidate)); i++) candidate = `${base}-${i}${ext}`;
    used.add(key(candidate));
    return candidate;
  });
}

/** Build entry paths for a CrossPoint overlay ZIP from the original filenames. */
export function overlayZipNames(fileNames: string[]): string[] {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const suffixLength = `-${fileNames.length}`.length;
  const buffer = new Uint8Array(CROSSPOINT_MAX_FILENAME_BYTES - OVERLAY_PNG_EXTENSION.length - suffixLength);
  const names = fileNames.map((fileName) => {
    const sanitized = sanitizeBaseName(stripExtension(fileName));
    const { written } = encoder.encodeInto(sanitized, buffer);
    const base = decoder.decode(buffer.subarray(0, written)).replace(/[\s.]+$/g, '');
    // Windows reserves device names even when followed by one or more extensions.
    const stem = base.split('.', 1)[0]?.trimEnd() ?? '';
    return `${OVERLAY_RESERVED_STEM.test(stem) ? 'image' : base}${OVERLAY_PNG_EXTENSION}`;
  });
  return uniqueNames(names, (name) => name.toLowerCase().toUpperCase().normalize('NFC'))
    .map((name) => `.sleep-overlay/${name}`);
}
