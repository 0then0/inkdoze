import { describe, expect, it } from 'vitest';
import { getDevice, getInstallMethod } from '../src/catalog/index.ts';
import { effectiveTone, resolveFormat, selectableFormats } from '../src/formats/registry.ts';
import { buildJob } from '../src/pipeline/job.ts';
import { DEFAULT_ADJUST, DEFAULT_SETTINGS } from '../src/pipeline/types.ts';
import { initialState, reducer, effectiveSettings, type ImageItem } from '../src/ui/state.ts';

const src = { width: 3000, height: 2000 };
const x4 = getDevice('xteink-x4');

describe('render job', () => {
  it('uses the device resolution', () => {
    const r = buildJob(src, DEFAULT_SETTINGS, DEFAULT_ADJUST, x4, 'png');
    expect(r.ok && r.job.target).toEqual({ width: 480, height: 800 });
  });

  it('uses the cropped, rotated original size', () => {
    const r = buildJob(src, { ...DEFAULT_SETTINGS, target: 'original' }, { ...DEFAULT_ADJUST, rotation: 90, crop: { x: 0, y: 0, w: 0.5, h: 0.5 } }, x4, 'png');
    expect(r.ok && r.job.target).toEqual({ width: 1000, height: 1500 });
  });

  it('uses custom sizes and rejects oversize output', () => {
    const ok = buildJob(src, { ...DEFAULT_SETTINGS, target: 'custom', customWidth: 600, customHeight: 900 }, DEFAULT_ADJUST, x4, 'png');
    expect(ok.ok && ok.job.target).toEqual({ width: 600, height: 900 });
    const big = buildJob(src, { ...DEFAULT_SETTINGS, target: 'custom', customWidth: 9000, customHeight: 900 }, DEFAULT_ADJUST, x4, 'png');
    expect(big.ok).toBe(false);
  });

  it('caps gray levels and forces grayscale by format', () => {
    const s = { ...DEFAULT_SETTINGS, colorMode: 'color' as const, levels: 256 as const, dither: 'atkinson' as const };
    const r = buildJob(src, s, DEFAULT_ADJUST, x4, 'bmp2');
    expect(r.ok && [r.job.colorMode, r.job.levels, r.job.dither]).toEqual(['grayscale', 4, 'atkinson']);
    const c = buildJob(src, s, DEFAULT_ADJUST, x4, 'png');
    expect(c.ok && [c.job.colorMode, c.job.levels, c.job.dither]).toEqual(['color', 256, 'none']);
    expect(effectiveTone('bmp1', 'grayscale', 16)).toEqual({ colorMode: 'grayscale', levels: 2 });
  });

  it('picks colour or grayscale from the e-reader in auto colour mode', () => {
    const colour = buildJob(src, DEFAULT_SETTINGS, DEFAULT_ADJUST, getDevice('kobo-libra-colour'), 'png');
    expect(colour.ok && colour.job.colorMode).toBe('color');
    const gray = buildJob(src, DEFAULT_SETTINGS, DEFAULT_ADJUST, x4, 'png');
    expect(gray.ok && gray.job.colorMode).toBe('grayscale');
    const forced = buildJob(src, DEFAULT_SETTINGS, DEFAULT_ADJUST, getDevice('kobo-libra-colour'), 'bmp8');
    expect(forced.ok && forced.job.colorMode).toBe('grayscale');
    const manual = buildJob(src, { ...DEFAULT_SETTINGS, colorMode: 'grayscale' }, DEFAULT_ADJUST, getDevice('kobo-libra-colour'), 'png');
    expect(manual.ok && manual.job.colorMode).toBe('grayscale');
  });

  it('enables automatic tone by default', () => {
    const r = buildJob(src, DEFAULT_SETTINGS, DEFAULT_ADJUST, x4, 'png');
    expect(r.ok && r.job.autoTone).toBe(true);
  });

  it('resolves the recommended format from the install method', () => {
    expect(resolveFormat('auto', getInstallMethod('crosspoint'))).toBe('bmp24');
    expect(resolveFormat('auto', getInstallMethod('kobo-screensaver-folder'))).toBe('jpeg');
    expect(resolveFormat('auto', undefined)).toBe('png');
    expect(resolveFormat('bmp2', getInstallMethod('crosspoint'))).toBe('bmp2');
  });

  it('hides PXC from the format menu', () => {
    expect(selectableFormats(getInstallMethod('crosspoint'))).not.toContain('pxc');
  });
});

describe('batch versus per-file settings', () => {
  const item = (id: string): ImageItem => ({
    id,
    file: new File([], `${id}.png`),
    name: id,
    status: 'ready',
    width: 10,
    height: 10,
    overrides: {},
    adjust: DEFAULT_ADJUST,
  });

  it('writes to the batch in "all" scope and to one file in "one" scope', () => {
    let s = reducer(initialState, { type: 'addImages', items: [item('a'), item('b')] });
    s = reducer(s, { type: 'setSettings', patch: { brightness: 10 } });
    expect(s.batch.brightness).toBe(10);
    s = reducer(s, { type: 'select', id: 'b' });
    s = reducer(s, { type: 'setScope', scope: 'one' });
    s = reducer(s, { type: 'setSettings', patch: { fit: 'fit', brightness: -20 } });
    expect(s.batch.fit).toBe(DEFAULT_SETTINGS.fit);
    const [a, b] = s.images;
    expect(effectiveSettings(s, a).brightness).toBe(10);
    expect(effectiveSettings(s, b)).toMatchObject({ fit: 'fit', brightness: -20 });
    // Batch changes still reach fields the file did not override.
    s = reducer(s, { type: 'setScope', scope: 'all' });
    s = reducer(s, { type: 'setSettings', patch: { contrast: 30, brightness: 50 } });
    expect(effectiveSettings(s, s.images[1])).toMatchObject({ contrast: 30, brightness: -20 });
    s = reducer(s, { type: 'resetOverrides', id: 'b' });
    expect(effectiveSettings(s, s.images[1]).brightness).toBe(50);
  });

  it('keeps framing per file', () => {
    let s = reducer(initialState, { type: 'addImages', items: [item('a'), item('b')] });
    s = reducer(s, { type: 'setAdjust', id: 'a', patch: { rotation: 90 } });
    expect(s.images[0]!.adjust.rotation).toBe(90);
    expect(s.images[1]!.adjust.rotation).toBe(0);
  });

  it('switches to a custom target when no device is chosen', () => {
    const s = reducer(initialState, { type: 'selectDevice', id: null });
    expect(s.batch.target).toBe('custom');
  });
});
