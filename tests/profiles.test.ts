import { describe, expect, it, vi } from 'vitest';
import { CROSSPOINT_OVERLAY_METHOD } from '../src/catalog/install.ts';
import { DEFAULT_SETTINGS } from '../src/pipeline/types.ts';
import { decodeProfiles, editProfileRecord, encodeProfileFile, MAX_PROFILE_FILE_BYTES, MAX_PROFILE_NAME, MAX_PROFILES, readProfileFile } from '../src/ui/profiles.ts';

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
    expect(save(' profile 1 ')).toEqual({ error: 'profiles.duplicate', suggestedName: 'profile 1 (2)' });
    for (let i = 2; i < MAX_PROFILES; i++) save(`Profile ${i}`);
    expect(record.read()).toHaveLength(MAX_PROFILES);
    expect(save('Overflow')).toEqual({ error: 'profiles.limit' });

    record.edit({ type: 'delete', id: record.read()![0]!.id });
    expect(save('Replacement')).toHaveProperty('profiles');
    expect(record.read()).toHaveLength(MAX_PROFILES);
  });

  it('suggests an available name without splitting a surrogate pair or exceeding the name limit', () => {
    const record = profileRecord();
    const save = (name: string) => record.edit({ type: 'save', ...standard, name, settings: DEFAULT_SETTINGS });
    const base = 'a'.repeat(MAX_PROFILE_NAME - 5);
    const name = `${base}📚abc`;
    save(name);
    save(`${base} (2)`);
    expect(save(name)).toEqual({ error: 'profiles.duplicate', suggestedName: `${base} (3)` });
  });
});

describe('profile files', () => {
  const profile = { ...standard, name: 'Четыре оттенка', settings: { ...DEFAULT_SETTINGS, contrast: 25 } };
  const envelope = { format: 'inkdoze.processing-profile', version: 1 };
  const document = { ...envelope, ...profile };
  const jsonFile = (value: unknown) => new File([JSON.stringify(value)], 'profile.json');

  it('round trips exactly one saved profile without the local ID', async () => {
    const saved = { ...profile, id: 'local-only' };
    const json = encodeProfileFile(saved);
    expect(JSON.parse(json)).toEqual(document);
    expect(await readProfileFile(new File([json], 'profile.json'))).toEqual({ profile });
  });

  it.each([
    { ...profile, deviceId: null, settings: { ...profile.settings, target: 'original' as const } },
    { ...profile, outputMode: CROSSPOINT_OVERLAY_METHOD, settings: { fit: 'fill' as const } },
  ] as const)('preserves the settings for $deviceId in $outputMode mode', async (variant) => {
    expect(await readProfileFile(jsonFile({ ...envelope, ...variant }))).toEqual({ profile: variant });
    const result = editProfileRecord(undefined, { ...variant, type: 'save' });
    expect(result).toEqual({ profiles: [{ ...variant, id: expect.any(String) }], selectedId: expect.any(String) });
    if ('profiles' in result) expect(JSON.parse(encodeProfileFile(result.profiles[0]!))).toEqual({ ...envelope, ...variant });
  });

  it.each([
    [{ format: 'unknown' }, 'format'],
    [{ version: 2 }, 'version'],
    [{ version: '1' }, 'version'],
    [{ id: 'local-only' }, 'format'],
    [{ name: ' Padded name ' }, 'name'],
    [{ name: 'a\u0000b' }, 'name'],
    [{ name: 'a'.repeat(MAX_PROFILE_NAME + 1) }, 'name'],
    [{ deviceId: 'obsolete-model' }, 'model'],
    [{ deviceId: undefined }, 'model'],
    [{ outputMode: 'unknown-mode' }, 'mode'],
    [{ deviceId: 'boox-palma', outputMode: CROSSPOINT_OVERLAY_METHOD }, 'mode'],
    [{ deviceId: null }, 'settings'],
    [{ settings: { ...profile.settings, customHeight: 1.5 } }, 'settings'],
    [{ settings: { ...profile.settings, brightness: 101 } }, 'settings'],
    [{ settings: { ...profile.settings, jpegQuality: undefined } }, 'settings'],
    [{ settings: { ...profile.settings, rotation: 90 } }, 'settings'],
    [{ outputMode: CROSSPOINT_OVERLAY_METHOD, settings: { fit: 'fit', target: 'device' } }, 'settings'],
  ])('rejects %j with a %s error', async (patch, error) => {
    expect(await readProfileFile(jsonFile({ ...document, ...patch }))).toEqual({ error: `profiles.file.${error}` });
  });

  it('checks the byte limit before reading and reports failed reads and invalid JSON', async () => {
    const tooLarge = new File([new Uint8Array(MAX_PROFILE_FILE_BYTES + 1)], 'large.json');
    const read = vi.spyOn(tooLarge, 'arrayBuffer');
    expect(await readProfileFile(tooLarge)).toEqual({ error: 'profiles.file.tooLarge' });
    expect(read).not.toHaveBeenCalled();

    const bytes = new TextEncoder().encode(JSON.stringify(document));
    const atLimit = new File([bytes, ' '.repeat(MAX_PROFILE_FILE_BYTES - bytes.length)], 'limit.json');
    expect(await readProfileFile(atLimit)).toEqual({ profile });

    const unreadable = jsonFile(document);
    vi.spyOn(unreadable, 'arrayBuffer').mockRejectedValueOnce(new Error('read failed'));
    expect(await readProfileFile(unreadable)).toEqual({ error: 'profiles.file.read' });
    expect(await readProfileFile(new File(['{broken'], 'broken.json'))).toEqual({ error: 'profiles.file.json' });
    const invalidUtf8 = new File(['"', new Uint8Array([0xff]), '"'], 'broken.json');
    expect(await readProfileFile(invalidUtf8)).toEqual({ error: 'profiles.file.json' });
  });
});
