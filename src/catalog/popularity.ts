import type { Brand, Device } from './types.ts';

/**
 * Approximate popularity used to order the device list. There is no public sales
 * data per model, so the score is an editorial estimate built from three parts:
 *
 * - brand reach: rough share of the e-reader market and size of the user community;
 * - product line: flagship lines that sold far more than their siblings;
 * - recency: devices still in use and on sale are more likely to be looked up.
 *
 * Adjust the tables below when the picture changes; tests only check relative order
 * of a few clear cases.
 */

/** Recency counts from the year the page is opened, so the order ages without code changes. */
function currentYear(): number {
  return new Date().getFullYear();
}

const MAX_RECENCY = 36;

const BRAND_REACH: Record<Brand, number> = {
  Kindle: 100,
  Kobo: 85,
  BOOX: 62,
  PocketBook: 55,
  reMarkable: 55,
  Xteink: 50,
  tolino: 45,
  NOOK: 42,
  Supernote: 40,
  Sony: 34,
  Meebook: 22,
  Bigme: 20,
  Likebook: 18,
  Bookeen: 18,
  Boyue: 12,
  Viwoods: 12,
  DuRoBo: 10,
  BQ: 10,
  iriver: 10,
  Icarus: 8,
  Hanvon: 8,
  Hanlin: 8,
  MobiScribe: 8,
  iRex: 8,
  Ectaco: 6,
  NUUT: 6,
  txtr: 6,
  Oaxis: 5,
  Foxit: 5,
  'Spring Design': 5,
  Asus: 5,
  'COOL-ER': 5,
  Booq: 5,
  EGriver: 5,
  Imcosys: 4,
};

/** Bonus for product lines that dominate their brand's sales. Matched against the device ID. */
const LINE_BONUS: ReadonlyArray<readonly [RegExp, number]> = [
  [/^kindle-paperwhite-/, 30],
  [/^kindle-(2024|11|10|8)$/, 26],
  [/^kindle-colorsoft$/, 22],
  [/^kindle-oasis-/, 14],
  [/^kindle-scribe/, 14],
  [/^kindle-(keyboard|4|touch|5|7|voyage)$/, 12],
  [/^kobo-(clara|libra)/, 24],
  [/^kobo-(sage|elipsa|forma|nia)/, 12],
  [/^kobo-(glo|aura|touch|mini)/, 8],
  [/^remarkable-2$/, 26],
  [/^remarkable-paper-pro$/, 20],
  [/^remarkable-/, 8],
  [/^xteink-x4$/, 20],
  [/^xteink-/, 10],
  [/^boox-(palma|go-7|go-color-7|note-air|page|leaf|tab-ultra|go-6|go-10)/, 14],
  [/^boox-volta/, 10],
  [/^boox-(nova|poke|note|max|tab)/, 6],
  [/^pocketbook-(verse|era|inkpad|touch-lux|touch-hd)/, 12],
  [/^tolino-(shine|vision)/, 12],
  [/^supernote-(manta|nomad)/, 12],
  [/^nook-(glowlight-4|simple-touch|glowlight-plus|glowlight-3)/, 10],
  [/^sony-prs-t/, 20],
  [/^sony-dpt-/, 6],
];

/**
 * `year` defaults to the current year. Recency is capped, so a model dated after
 * that year (for example on a device with a wrong clock) gets no extra boost.
 */
export function popularity(d: Device, year: number = currentYear()): number {
  const reach = BRAND_REACH[d.brand] ?? 0;
  const line = LINE_BONUS.find(([re]) => re.test(d.id))?.[1] ?? 0;
  const recency = Math.min(MAX_RECENCY, Math.max(0, MAX_RECENCY - 3 * (year - d.year)));
  return reach + line + recency;
}

/** Most popular first; ties go to the newer model, then alphabetical. */
export function byPopularity(a: Device, b: Device): number {
  const year = currentYear();
  return popularity(b, year) - popularity(a, year) || b.year - a.year || `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`);
}

/** Brands ordered by their most popular model. */
export function brandsByPopularity(devices: readonly Device[]): Brand[] {
  const best = new Map<Brand, number>();
  const year = currentYear();
  for (const d of devices) best.set(d.brand, Math.max(best.get(d.brand) ?? 0, popularity(d, year)));
  return [...best.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([brand]) => brand);
}
