import { getDevice } from '../catalog/index.ts';
import { CROSSPOINT_OVERLAY_METHOD } from '../catalog/install.ts';
import { selectableFormats } from '../formats/registry.ts';
import { LIMITS } from '../io/limits.ts';
import type { OutputSettings } from '../pipeline/types.ts';
import type { AppState } from './state.ts';

export const PROFILES_KEY = 'inkdoze.profiles';
export const MAX_PROFILES = 40;
export const MAX_PROFILE_NAME = 64;
const VERSION = 1;
const PROFILE_STORE = 'profiles';
const CURRENT_RECORD = 'current';
const STANDARD_FORMATS = ['auto', ...selectableFormats(undefined)] as const;

export type ProfileContext = Pick<AppState, 'deviceId' | 'outputMode'>;

export type ProcessingProfile = { id: string; name: string; deviceId: ProfileContext['deviceId'] } & (
  | { outputMode: 'standard'; settings: OutputSettings }
  | { outputMode: typeof CROSSPOINT_OVERLAY_METHOD; settings: Pick<OutputSettings, 'fit'> }
);

type Change =
  | ({ type: 'save'; name: string; settings: OutputSettings } & ProfileContext)
  | { type: 'rename'; id: string; name: string }
  | { type: 'delete'; id: string };

type ChangeResult = { profiles: ProcessingProfile[]; selectedId: string } | {
  error: 'profiles.invalidName' | 'profiles.duplicate' | 'profiles.limit' | 'profiles.invalidSettings'
    | 'profiles.missing' | 'profiles.newerVersion' | 'profiles.storage';
};

export function sameProfileContext(a: ProfileContext, b: ProfileContext): boolean {
  return a.deviceId === b.deviceId && a.outputMode === b.outputMode;
}

function cleanName(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > MAX_PROFILE_NAME) return null;
  const name = value.trim().normalize('NFC');
  return name && name.length <= MAX_PROFILE_NAME && !/\p{Cc}/u.test(name) ? name : null;
}

function nameInUse(profiles: ProcessingProfile[], candidate: ProcessingProfile): boolean {
  return profiles.some((profile) => profile.id !== candidate.id && sameProfileContext(profile, candidate)
    && profile.name.toLowerCase() === candidate.name.toLowerCase());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string | number>(value: unknown, options: readonly T[]): value is T {
  return options.some((option) => option === value);
}

function inRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && value >= min && value <= max;
}

function isDimension(value: unknown): value is number {
  return inRange(value, 1, LIMITS.maxOutputSide) && Number.isInteger(value);
}

function readStandardSettings(settings: Record<string, unknown>, fit: OutputSettings['fit']): OutputSettings | null {
  const { target, customWidth, customHeight, background, colorMode, autoTone, brightness, contrast, invert, levels, dither, format, jpegQuality } = settings;
  if (
    !isOneOf(target, ['device', 'original', 'custom'] as const)
    || !isDimension(customWidth) || !isDimension(customHeight)
    || (target === 'custom' && customWidth * customHeight > LIMITS.maxOutputPixels)
    || typeof background !== 'string' || !/^#[\da-f]{6}$/i.test(background)
    || !isOneOf(colorMode, ['auto', 'grayscale', 'color'] as const)
    || typeof autoTone !== 'boolean' || typeof invert !== 'boolean'
    || !inRange(brightness, -100, 100) || !Number.isInteger(brightness)
    || !inRange(contrast, -100, 100) || !Number.isInteger(contrast)
    || !isOneOf(levels, [256, 16, 4, 2] as const)
    || !isOneOf(dither, ['none', 'floyd-steinberg', 'atkinson'] as const)
    || !isOneOf(format, STANDARD_FORMATS) || !inRange(jpegQuality, 0.5, 1)
  ) return null;
  return { target, customWidth, customHeight, fit, background, colorMode, autoTone, brightness, contrast, invert, levels, dither, format, jpegQuality };
}

function readProfile(value: unknown): ProcessingProfile | null {
  if (!isRecord(value)) return null;
  const { id, deviceId, outputMode, settings } = value;
  const name = cleanName(value.name);
  if (!name || typeof id !== 'string' || !/^[a-z\d-]{1,64}$/i.test(id) || !isRecord(settings)) return null;
  if (deviceId !== null && typeof deviceId !== 'string') return null;
  const device = deviceId === null ? undefined : getDevice(deviceId);
  if (deviceId !== null && !device) return null;
  const { fit } = settings;
  if (!isOneOf(fit, ['fit', 'fill', 'stretch'] as const)) return null;

  if (outputMode === CROSSPOINT_OVERLAY_METHOD && device?.install.includes(CROSSPOINT_OVERLAY_METHOD)) {
    return { id, name, deviceId, outputMode, settings: { fit } };
  }
  if (outputMode !== 'standard') return null;
  const standard = readStandardSettings(settings, fit);
  if (!standard || (!device && standard.target === 'device')) return null;
  return { id, name, deviceId, outputMode, settings: standard };
}

/** A null result protects records written by a newer build from being overwritten. */
export function decodeProfiles(raw: unknown): ProcessingProfile[] | null {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!isRecord(value)) return [];
  if (typeof value.version === 'number' && Number.isInteger(value.version) && value.version > VERSION) return null;
  if (value.version !== VERSION || !Array.isArray(value.profiles)) return [];

  const profiles: ProcessingProfile[] = [];
  for (const entry of value.profiles.slice(0, MAX_PROFILES)) {
    const profile = readProfile(entry);
    if (profile && !profiles.some(({ id }) => id === profile.id) && !nameInUse(profiles, profile)) profiles.push(profile);
  }
  return profiles;
}

export function editProfileRecord(raw: unknown, change: Change): ChangeResult {
  const profiles = decodeProfiles(raw);
  if (profiles === null) return { error: 'profiles.newerVersion' };
  if (change.type === 'delete') {
    return { profiles: profiles.filter(({ id }) => id !== change.id), selectedId: '' };
  }
  const name = cleanName(change.name);
  if (!name) return { error: 'profiles.invalidName' };
  if (change.type === 'save' && profiles.length >= MAX_PROFILES) return { error: 'profiles.limit' };
  const profile = change.type === 'save'
    ? readProfile({ ...change, name, id: crypto.randomUUID() })
    : profiles.find(({ id }) => id === change.id);
  if (!profile) return { error: change.type === 'save' ? 'profiles.invalidSettings' : 'profiles.missing' };
  const candidate = { ...profile, name };
  if (nameInUse(profiles, candidate)) return { error: 'profiles.duplicate' };
  const next = change.type === 'save'
    ? [...profiles, candidate]
    : profiles.map((entry) => entry.id === profile.id ? candidate : entry);
  return { profiles: next, selectedId: profile.id };
}

function legacyRecord(): string | null {
  try {
    return localStorage.getItem(PROFILES_KEY);
  } catch {
    return null;
  }
}

function openProfileDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PROFILES_KEY, 1);
    let blocked = false;
    request.onupgradeneeded = () => request.result.createObjectStore(PROFILE_STORE);
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      blocked = true;
      reject(new Error('The profile database is blocked'));
    };
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) db.close();
      else {
        db.onversionchange = () => db.close();
        resolve(db);
      }
    };
  });
}

async function withProfileRecord<T>(mode: 'readonly' | 'readwrite', handleRecord: (raw: unknown, store: IDBObjectStore) => T): Promise<T> {
  const db = await openProfileDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(PROFILE_STORE, mode);
      const store = transaction.objectStore(PROFILE_STORE);
      const read = store.get(CURRENT_RECORD);
      let result: T;
      read.onsuccess = () => {
        try {
          // Read and update in the same active transaction. Use the legacy record only before the first write.
          const raw: unknown = read.result;
          result = handleRecord(raw === undefined ? legacyRecord() : raw, store);
        } catch (error) {
          reject(error);
          transaction.abort();
        }
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export async function loadProfiles(): Promise<ProcessingProfile[]> {
  try {
    return await withProfileRecord('readonly', (raw) => decodeProfiles(raw) ?? []);
  } catch {
    return [];
  }
}

export async function updateProfiles(change: Change): Promise<ChangeResult> {
  try {
    return await withProfileRecord('readwrite', (raw, store) => {
      const next = editProfileRecord(raw, change);
      if ('profiles' in next) store.put({ version: VERSION, profiles: next.profiles }, CURRENT_RECORD);
      return next;
    });
  } catch {
    return { error: 'profiles.storage' };
  }
}
