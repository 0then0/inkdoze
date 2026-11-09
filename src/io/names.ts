const MAX_BASE = 100;

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
export function uniqueNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((name) => {
    const dot = name.lastIndexOf('.');
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    let candidate = name;
    for (let i = 2; used.has(candidate.toLowerCase()); i++) candidate = `${base}-${i}${ext}`;
    used.add(candidate.toLowerCase());
    return candidate;
  });
}
