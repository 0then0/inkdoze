import type { Device, InstallMethod, OutputFormat } from '../catalog/types.ts';
import { FORMATS, resolveFormat, selectableFormats } from '../formats/registry.ts';
import { useI18n } from '../i18n/index.ts';
import type { TextKey } from '../i18n/keys.ts';
import { LIMITS } from '../io/limits.ts';
import { clampDimension } from '../pipeline/job.ts';
import type { Dither, FitMode, Levels, OutputSettings, TargetMode } from '../pipeline/types.ts';
import { useEffect, useState } from 'preact/hooks';
import { Icon } from './Icon.tsx';
import type { Action, ImageItem, Scope } from './state.ts';

/**
 * Number input that keeps the typed draft locally and commits on change/blur, so
 * re-renders (for example a finished preview) cannot reset what the user is typing.
 */
function DimensionInput({ label, value, testId, onCommit }: { label: string; value: number; testId: string; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <label>
      <span>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={LIMITS.maxOutputSide}
        value={draft}
        data-testid={testId}
        onInput={(e) => setDraft(e.currentTarget.value)}
        onChange={(e) => {
          const v = clampDimension(Number(e.currentTarget.value));
          setDraft(String(v));
          onCommit(v);
        }}
      />
    </label>
  );
}

interface Props {
  settings: OutputSettings;
  scope: Scope;
  selected: ImageItem | undefined;
  device: Device | undefined;
  method: InstallMethod | undefined;
  dispatch: (a: Action) => void;
}

function Radios<T extends string | number>(props: {
  name: string;
  legend: string;
  value: T;
  options: ReadonlyArray<readonly [T, string]>;
  onChange: (v: T) => void;
  disabled?: (v: T) => boolean;
  describedBy?: string;
}) {
  return (
    <fieldset class="segmented" aria-describedby={props.describedBy}>
      <legend>{props.legend}</legend>
      {props.options.map(([v, label]) => (
        <label key={String(v)}>
          <input
            type="radio"
            name={props.name}
            value={String(v)}
            checked={props.value === v}
            disabled={props.disabled?.(v) ?? false}
            onChange={() => props.onChange(v)}
          />
          <span>{label}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function SettingsPanel({ settings: s, scope, selected, device, method, dispatch }: Props) {
  const { t } = useI18n();
  const set = (patch: Partial<OutputSettings>) => dispatch({ type: 'setSettings', patch });
  const format: OutputFormat = resolveFormat(s.format, method);
  const info = FORMATS[format];
  const grayOnly = info.grayscaleOnly;
  const levelsCapped = s.colorMode === 'grayscale' || grayOnly ? s.levels > info.maxLevels : false;
  const effectiveLevels = Math.min(s.levels, info.maxLevels);
  const ditherActive = (grayOnly || s.colorMode === 'grayscale') && effectiveLevels < 256;
  const formats = selectableFormats(method);
  const unconfirmed = method && method.formats.length > 0 && !method.formats.includes(format);
  const oneDisabled = !selected;

  return (
    <section class="panel settings-panel" aria-labelledby="settings-title">
      <div class="panel-head">
        <h2 id="settings-title">{t('settings.title')}</h2>
      </div>

      <div class={`scope scope-${scope}`}>
        <Radios
          name="scope"
          legend={t('settings.scope')}
          value={scope}
          options={[
            ['all', t('settings.scopeAll')],
            ['one', t('settings.scopeOne')],
          ]}
          disabled={(v) => v === 'one' && oneDisabled}
          onChange={(v) => dispatch({ type: 'setScope', scope: v })}
        />
        {oneDisabled && <p class="hint">{t('settings.scopeOneDisabled')}</p>}
        {scope === 'one' && selected && (
          <p class="scope-note" data-testid="scope-note">
            <Icon name="info" size={14} /> {t('settings.scopeNote', { name: selected.file.name })}
            <br />
            <button type="button" class="link-button" onClick={() => dispatch({ type: 'resetOverrides', id: selected.id })}>
              {t('settings.resetOne')}
            </button>
          </p>
        )}
      </div>

      <Radios<TargetMode>
        name="target"
        legend={t('settings.size')}
        value={s.target}
        options={[
          ['device', t('settings.targetDevice')],
          ['original', t('settings.targetOriginal')],
          ['custom', t('settings.targetCustom')],
        ]}
        disabled={(v) => v === 'device' && !device}
        onChange={(v) => set({ target: v })}
      />
      {s.target === 'custom' && (
        <div class="dims">
          <DimensionInput label={t('settings.width')} value={s.customWidth} testId="custom-width" onCommit={(v) => set({ customWidth: v })} />
          <button type="button" class="icon-button" aria-label={t('settings.swap')} title={t('settings.swap')} onClick={() => set({ customWidth: s.customHeight, customHeight: s.customWidth })}>
            <Icon name="swap" />
          </button>
          <DimensionInput label={t('settings.height')} value={s.customHeight} testId="custom-height" onCommit={(v) => set({ customHeight: v })} />
        </div>
      )}

      <Radios<FitMode>
        name="fit"
        legend={t('settings.fit')}
        value={s.fit}
        describedBy="fit-help"
        options={[
          ['fit', t('settings.fitFit')],
          ['fill', t('settings.fitFill')],
          ['stretch', t('settings.fitStretch')],
        ]}
        onChange={(v) => set({ fit: v })}
      />
      <p class="hint" id="fit-help">
        {t(`settings.fitHelp.${s.fit}` as TextKey)}
      </p>

      <div class="field">
        <span class="field-label" id="bg-label">
          {t('settings.background')}
        </span>
        <div class="bg-row" role="group" aria-labelledby="bg-label">
          <button type="button" class={`swatch white${s.background.toLowerCase() === '#ffffff' ? ' on' : ''}`} aria-pressed={s.background.toLowerCase() === '#ffffff'} onClick={() => set({ background: '#ffffff' })}>
            {t('settings.white')}
          </button>
          <button type="button" class={`swatch black${s.background.toLowerCase() === '#000000' ? ' on' : ''}`} aria-pressed={s.background.toLowerCase() === '#000000'} onClick={() => set({ background: '#000000' })}>
            {t('settings.black')}
          </button>
          <input type="color" value={s.background} aria-label={t('settings.background')} data-testid="background" onInput={(e) => set({ background: e.currentTarget.value })} />
        </div>
        <p class="hint">{t('settings.backgroundHint')}</p>
      </div>

      <h3 class="section-title">{t('settings.tone')}</h3>
      <Radios
        name="color-mode"
        legend={t('settings.colorMode')}
        value={grayOnly ? 'grayscale' : s.colorMode}
        options={[
          ['grayscale', t('settings.grayscale')],
          ['color', t('settings.color')],
        ]}
        disabled={(v) => v === 'color' && grayOnly}
        onChange={(v) => set({ colorMode: v })}
      />
      {grayOnly && <p class="hint">{t('settings.colorForced')}</p>}

      {(['brightness', 'contrast'] as const).map((key) => (
        <div class="slider" key={key}>
          <label for={`tone-${key}`}>{t(`settings.${key}`)}</label>
          <input id={`tone-${key}`} type="range" min={-100} max={100} step={1} value={s[key]} onInput={(e) => set({ [key]: Number(e.currentTarget.value) })} />
          <output for={`tone-${key}`}>{s[key]}</output>
        </div>
      ))}
      <label class="toggle">
        <input type="checkbox" checked={s.invert} onChange={(e) => set({ invert: e.currentTarget.checked })} />
        <span>{t('settings.invert')}</span>
      </label>

      {(s.colorMode === 'grayscale' || grayOnly) && (
        <>
          <Radios<Levels>
            name="levels"
            legend={t('settings.levels')}
            value={s.levels}
            options={[
              [256, t('settings.levels256')],
              [16, t('settings.levels16')],
              [4, t('settings.levels4')],
              [2, t('settings.levels2')],
            ]}
            onChange={(v) => set({ levels: v })}
          />
          {levelsCapped && <p class="hint">{t('settings.levelsCapped', { levels: info.maxLevels })}</p>}
          <Radios<Dither>
            name="dither"
            legend={t('settings.dither')}
            value={s.dither}
            options={[
              ['none', t('settings.ditherNone')],
              ['floyd-steinberg', t('settings.ditherFs')],
              ['atkinson', t('settings.ditherAtkinson')],
            ]}
            disabled={() => !ditherActive}
            onChange={(v) => set({ dither: v })}
          />
          {!ditherActive && <p class="hint">{t('settings.ditherOff')}</p>}
        </>
      )}

      <div class="field">
        <label class="field-label" for="format">
          {t('settings.format')}
        </label>
        <select id="format" value={s.format} data-testid="format" onChange={(e) => set({ format: e.currentTarget.value as OutputSettings['format'] })}>
          <option value="auto">{t('settings.formatAuto', { format: t(`format.${resolveFormat('auto', method)}`) })}</option>
          {formats.map((f) => (
            <option key={f} value={f}>
              {t(`format.${f}`)}
            </option>
          ))}
        </select>
        {unconfirmed && method && (
          <p class="hint warn-text">
            <Icon name="warn" size={14} /> {t('settings.formatUnconfirmed', { format: t(`format.${format}`), method: t(`method.${method.id}` as TextKey) })}
          </p>
        )}
      </div>
      {format === 'jpeg' && (
        <div class="slider">
          <label for="jpeg-quality">{t('settings.quality')}</label>
          <input id="jpeg-quality" type="range" min={0.5} max={1} step={0.01} value={s.jpegQuality} onInput={(e) => set({ jpegQuality: Number(e.currentTarget.value) })} />
          <output for="jpeg-quality">{Math.round(s.jpegQuality * 100)}</output>
        </div>
      )}
    </section>
  );
}
