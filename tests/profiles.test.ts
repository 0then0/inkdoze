import { describe, expect, it } from 'vitest';
import { CROSSPOINT_OVERLAY_METHOD } from '../src/catalog/install.ts';
import { DEFAULT_SETTINGS } from '../src/pipeline/types.ts';
import { decodeProfiles, editProfileRecord, MAX_PROFILE_NAME, MAX_PROFILES } from '../src/ui/profiles.ts';

const standard = { deviceId: 'xteink-x4', outputMode: 'standard' } as const;

function profileRecord(raw: unknown = undefined) {
  return {
    read: () => decodeProfiles(raw),
    edit: (change: Parameters<typeof editProfileRecord>[1]) => {
      const result = editProfileRecord(raw, change);
      if ('profiles' in result) raw = { version: 1, profiles: result.profiles };
      return result;
    },
  };
}

describe('processing profile records', () => {
  it('stores only settings supported by the profile mode', () => {
    const record = profileRecord();
    const settings = { ...DEFAULT_SETTINGS, fit: 'fit' as const, format: 'jpeg' as const };
    const withImageData = { ...settings, file: 'photo.png', crop: { x: 0, y: 0, w: 1, h: 1 }, rotation: 90 };
    const standardProfile = { ...standard, id: expect.any(String), name: 'Standard', settings };
    expect(record.edit({ type: 'save', ...standard, name: ' Standard ', settings: withImageData })).toEqual({
      profiles: [standardProfile], selectedId: expect.any(String),
    });
    expect(record.edit({ type: 'save', ...standard, outputMode: CROSSPOINT_OVERLAY_METHOD, name: 'Overlay', settings: withImageData })).toEqual({
      profiles: [standardProfile, { ...standard, id: expect.any(String), name: 'Overlay', outputMode: CROSSPOINT_OVERLAY_METHOD, settings: { fit: 'fit' } }],
      selectedId: expect.any(String),
    });
  });

  it('keeps valid entries and drops invalid or obsolete entries', () => {
    const valid = { ...standard, id: 'valid', name: 'Valid', settings: DEFAULT_SETTINGS };
    const invalidSettings = [
      { fit: 'unknown' }, { target: 'custom', customWidth: 8192, customHeight: 8192 }, { customHeight: 1.5 },
      { background: 'red' }, { colorMode: 'gray' }, { autoTone: 'true' }, { invert: 1 }, { brightness: 101 },
      { contrast: null }, { levels: 8 }, { dither: 'unknown' }, { format: 'pxc' }, { jpegQuality: 1.1 },
    ];
    const record = { version: 1, profiles: [
      ...invalidSettings.map((patch, i) => ({ ...valid, id: `invalid-${i}`, settings: { ...DEFAULT_SETTINGS, ...patch } })),
      { ...valid, id: 'removed-model', deviceId: 'obsolete' },
      { ...valid, id: 'wrong-mode', outputMode: CROSSPOINT_OVERLAY_METHOD, deviceId: 'boox-palma' },
      { ...valid, id: 'blank', name: '   ' },
      { ...valid, id: 'long', name: 'A'.repeat(MAX_PROFILE_NAME + 1) },
      valid,
      { ...valid, name: 'Duplicated ID' },
      { ...valid, id: 'duplicate-name', name: 'valid' },
    ] };
    expect(decodeProfiles(record)).toEqual([valid]);
    expect(decodeProfiles(JSON.stringify(record))).toEqual([valid]);
  });

  it('recovers from obsolete and malformed records and protects newer versions', () => {
    const change = { type: 'save', ...standard, name: 'New profile', settings: DEFAULT_SETTINGS } as const;
    for (const raw of ['{', { version: 0, profiles: {} }]) {
      expect(decodeProfiles(raw)).toEqual([]);
      expect(editProfileRecord(raw, change)).toHaveProperty('profiles');
    }
    const newer = { version: 2, anotherSchema: true };
    expect(decodeProfiles(newer)).toBeNull();
    expect(editProfileRecord(newer, change)).toEqual({ error: 'profiles.newerVersion' });
  });

  it('bounds names and the number of profiles and frees space on deletion', () => {
    const record = profileRecord();
    const save = (name: string) => record.edit({ type: 'save', ...standard, name, settings: DEFAULT_SETTINGS });
    expect(save('  ')).toEqual({ error: 'profiles.invalidName' });
    expect(save('あ'.repeat(MAX_PROFILE_NAME + 1))).toEqual({ error: 'profiles.invalidName' });
    expect(save('あ'.repeat(MAX_PROFILE_NAME))).toHaveProperty('profiles');
    expect(save('Profile 1')).toHaveProperty('profiles');
    expect(save(' profile 1 ')).toEqual({ error: 'profiles.duplicate' });
    for (let i = 2; i < MAX_PROFILES; i++) save(`Profile ${i}`);
    expect(record.read()).toHaveLength(MAX_PROFILES);
    expect(save('Overflow')).toEqual({ error: 'profiles.limit' });

    record.edit({ type: 'delete', id: record.read()![0]!.id });
    expect(save('Replacement')).toHaveProperty('profiles');
    expect(record.read()).toHaveLength(MAX_PROFILES);
  });
});
