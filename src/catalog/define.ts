import type { InstallMethodId } from './install.ts';
import type { Brand, Device, InstallStep, Source } from './types.ts';

/** Date the catalog was last checked against its sources. */
export const VERIFIED = '2026-11-10';

/** Compact record format used by the catalog files. */
export interface Spec {
  id: string;
  model: string;
  generation: string;
  ordinal?: number;
  year: number;
  w: number;
  h: number;
  color?: boolean;
  aliases?: string[];
  sources: Source[];
  install: InstallMethodId[];
  notes?: InstallStep[];
}

export function brand(name: Brand, specs: Spec[]): Device[] {
  return specs.map((s) => ({
    id: s.id,
    brand: name,
    model: s.model,
    generation: s.generation,
    ...(s.ordinal ? { ordinal: s.ordinal } : {}),
    year: s.year,
    aliases: s.aliases ?? [],
    resolution: { width: s.w, height: s.h },
    color: s.color ?? false,
    sources: s.sources,
    verified: VERIFIED,
    install: s.install,
    ...(s.notes ? { notes: s.notes } : {}),
  }));
}
