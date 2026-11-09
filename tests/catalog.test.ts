import { describe, expect, it } from 'vitest';
import { DEVICES, INSTALL_METHODS, deviceStatus, getDevice, searchDevices } from '../src/catalog/index.ts';
import type { Device, InstallMethod } from '../src/catalog/types.ts';
import { validateCatalog } from '../src/catalog/validate.ts';
import { isMessageKey } from '../src/i18n/index.ts';

const TODAY = '2026-11-10';
const validate = (devices: readonly Device[], methods: Record<string, InstallMethod> = INSTALL_METHODS) =>
  validateCatalog(devices, methods, isMessageKey, TODAY);

const base = DEVICES[0]!;

describe('catalog data', () => {
  it('passes validation', () => {
    expect(validate(DEVICES)).toEqual([]);
  });

  it('covers every required brand', () => {
    const brands = new Set(DEVICES.map((d) => d.brand));
    for (const b of ['Kindle', 'Kobo', 'BOOX', 'PocketBook', 'Xteink', 'tolino', 'NOOK', 'Bigme', 'Meebook', 'Supernote', 'reMarkable']) {
      expect(brands.has(b as Device['brand']), b).toBe(true);
    }
  });

  it('keeps reference models with their verified resolutions', () => {
    const expected: Record<string, [number, number]> = {
      'xteink-x4': [480, 800],
      'xteink-x4-classic': [480, 800],
      'xteink-x4-pro': [480, 800],
      'xteink-x3': [528, 792],
      'boox-picco': [480, 800],
      'boox-palma-2': [824, 1648],
      'boox-palma-3': [824, 1648],
      'kindle-2024': [1072, 1448],
      'kindle-scribe': [1860, 2480],
      'kobo-clara-bw': [1072, 1448],
      'kobo-libra-colour': [1264, 1680],
      'kobo-sage': [1440, 1920],
      'kobo-elipsa-2e': [1404, 1872],
      'remarkable-2': [1404, 1872],
      'remarkable-paper-pro': [1620, 2160],
      'remarkable-paper-pro-move': [954, 1696],
    };
    for (const [id, [w, h]] of Object.entries(expected)) {
      const d = getDevice(id);
      expect(d, id).toBeDefined();
      expect([d!.resolution.width, d!.resolution.height], id).toEqual([w, h]);
    }
  });

  it('records generations with different resolutions separately', () => {
    expect(getDevice('kindle-paperwhite-5')!.resolution).toEqual({ width: 1236, height: 1648 });
    expect(getDevice('kindle-paperwhite-6')!.resolution).toEqual({ width: 1272, height: 1696 });
    expect(getDevice('boox-note-air-3')!.resolution).not.toEqual(getDevice('boox-note-air-3-c')!.resolution);
  });

  it('only offers CrossPoint on devices with a CrossPoint 2.0.0 build', () => {
    const withCrossPoint = DEVICES.filter((d) => d.install.includes('crosspoint')).map((d) => d.id).sort();
    expect(withCrossPoint).toEqual(['boox-picco', 'xteink-x3', 'xteink-x4', 'xteink-x4-classic', 'xteink-x4-pro']);
  });

  it('never offers PXC for released firmware', () => {
    for (const m of Object.values(INSTALL_METHODS)) expect(m.formats).not.toContain('pxc');
  });

  it('derives size-only status for devices without methods', () => {
    expect(deviceStatus(getDevice('meebook-m7')!)).toBe('size-only');
    expect(deviceStatus(getDevice('kindle-paperwhite-6')!)).toBe('third-party');
    expect(deviceStatus(getDevice('boox-go-7')!)).toBe('custom-image');
  });
});

describe('catalog validation catches bad records', () => {
  const messages = (issues: { message: string }[]) => issues.map((i) => i.message).join('\n');

  it('flags duplicate ids', () => {
    expect(messages(validate([base, { ...base, model: 'Other', aliases: [] }]))).toMatch(/duplicate id/);
  });

  it('flags duplicate brand/model/generation', () => {
    expect(messages(validate([base, { ...base, id: 'copy', aliases: [] }]))).toMatch(/duplicate brand\/model\/generation/);
  });

  it('flags alias collisions across devices', () => {
    const other: Device = { ...base, id: 'other', model: 'Other', aliases: [base.aliases[0] ?? 'x4'] };
    expect(messages(validate([{ ...base, aliases: [other.aliases[0]!] }, other]))).toMatch(/alias/);
  });

  it('flags incomplete records', () => {
    const issues = messages(
      validate([{ ...base, model: ' ', generation: '', sources: [], verified: 'yesterday', resolution: { width: 0, height: 10 } }]),
    );
    expect(issues).toMatch(/missing model/);
    expect(issues).toMatch(/missing generation/);
    expect(issues).toMatch(/no sources/);
    expect(issues).toMatch(/YYYY-MM-DD/);
    expect(issues).toMatch(/positive integers/);
  });

  it('flags landscape resolutions, future dates, http sources and unknown methods', () => {
    const issues = messages(
      validate([
        {
          ...base,
          resolution: { width: 800, height: 480 },
          verified: '2099-01-01',
          sources: [{ kind: 'manufacturer', title: 'x', url: 'http://example.com' }],
          install: ['nope'],
        },
      ]),
    );
    expect(issues).toMatch(/portrait/);
    expect(issues).toMatch(/future/);
    expect(issues).toMatch(/not https/);
    expect(issues).toMatch(/unknown install method/);
  });

  it('flags methods whose status and formats disagree', () => {
    const bad: InstallMethod = { ...INSTALL_METHODS['kindle-cover'], formats: ['png'], recommendedFormat: 'png' };
    const missing: InstallMethod = { ...INSTALL_METHODS.crosspoint, recommendedFormat: undefined as never };
    const wrongRec: InstallMethod = { ...INSTALL_METHODS.crosspoint, recommendedFormat: 'png' };
    const issues = messages(validateCatalog([], { 'kindle-cover': bad, crosspoint: missing, other: { ...wrongRec, id: 'other' } }, isMessageKey, TODAY));
    expect(issues).toMatch(/cover-only method must not list formats/);
    expect(issues).toMatch(/needs a recommended format/);
    expect(issues).toMatch(/not among confirmed formats/);
  });

  it('flags message keys that do not exist', () => {
    const m: InstallMethod = { ...INSTALL_METHODS.crosspoint, steps: [{ key: 'install.missing' as never }] };
    expect(messages(validateCatalog([], { crosspoint: m }, isMessageKey, TODAY))).toMatch(/missing message key/);
  });
});

describe('device search', () => {
  const ids = (q: string) => searchDevices({ query: q }).map((d) => d.id);

  it('finds by alias, generation and year', () => {
    expect(ids('pw5')).toEqual(['kindle-paperwhite-5']);
    expect(ids('paperwhite 2021')).toContain('kindle-paperwhite-5');
    expect(ids('paperwhite 12th')).toEqual(['kindle-paperwhite-6']);
    expect(ids('kobo n428')).toEqual(['kobo-libra-colour']);
  });

  it('finds by resolution in either orientation', () => {
    expect(ids('1264x1680')).toEqual(ids('1680×1264'));
    expect(ids('1264x1680').length).toBeGreaterThan(5);
  });

  it('filters by brand and colour', () => {
    const colorKobo = searchDevices({ brands: ['Kobo'], color: 'color' }).map((d) => d.id);
    expect(colorKobo.sort()).toEqual(['kobo-clara-colour', 'kobo-libra-colour']);
    expect(searchDevices({ brands: ['Xteink'], color: 'color' })).toEqual([]);
  });
});
