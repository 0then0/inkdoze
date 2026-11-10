import { BRANDS_BY_POPULARITY, deviceStatus, searchDevices, type Device } from '../catalog/index.ts';
import type { Brand } from '../catalog/types.ts';
import { useState } from 'preact/hooks';
import { generationLabel, useI18n } from '../i18n/index.ts';
import { Icon } from './Icon.tsx';
import type { Action, AppState } from './state.ts';

interface Props {
  state: AppState;
  device: Device | undefined;
  dispatch: (a: Action) => void;
}

/** Brands shown as chips before the "More brands" disclosure. */
const MAIN_BRANDS = 12;

/** "Kindle Paperwhite", but "Kindle 2" rather than "Kindle Kindle 2". */
export function displayName(d: Device): string {
  return d.model.toLowerCase().startsWith(d.brand.toLowerCase()) ? d.model : `${d.brand} ${d.model}`;
}

function BrandChip({ brand, checked, onToggle }: { brand: Brand; checked: boolean; onToggle: () => void }) {
  return (
    <label class="chip">
      <input type="checkbox" checked={checked} onChange={onToggle} />
      <span>{brand}</span>
    </label>
  );
}

export function DevicePanel({ state, device, dispatch }: Props) {
  const tr = useI18n();
  const hiddenSelected = state.brands.some((b) => BRANDS_BY_POPULARITY.indexOf(b) >= MAIN_BRANDS);
  // The disclosure keeps the state the user gave it; it only opens itself to show a selected hidden brand.
  const [moreOpen, setMoreOpen] = useState(hiddenSelected);
  const { t, tp } = tr;
  const results = searchDevices({ query: state.query, brands: state.brands, color: state.colorFilter });
  const filtered = state.query !== '' || state.brands.length > 0 || state.colorFilter !== 'any';

  return (
    <section class="panel device-panel" aria-labelledby="device-title">
      <div class="panel-head">
        <h2 id="device-title">{t('device.title')}</h2>
        <span class="muted small" aria-live="polite">
          {tp('device.results', results.length)}
        </span>
      </div>

      <label class="search">
        <Icon name="search" />
        <span class="sr-only">{t('device.search')}</span>
        <input
          type="search"
          value={state.query}
          placeholder={t('device.search')}
          aria-describedby="device-search-hint"
          autocomplete="off"
          spellcheck={false}
          onInput={(e) => dispatch({ type: 'setQuery', query: e.currentTarget.value })}
        />
      </label>
      <p id="device-search-hint" class="hint">
        {t('device.searchHint')}
      </p>

      <fieldset class="chips">
        <legend>{t('device.brands')}</legend>
        {BRANDS_BY_POPULARITY.slice(0, MAIN_BRANDS).map((b) => (
          <BrandChip key={b} brand={b} checked={state.brands.includes(b)} onToggle={() => dispatch({ type: 'toggleBrand', brand: b })} />
        ))}
        <details class="more-brands" open={moreOpen || hiddenSelected} onToggle={(e) => setMoreOpen((e.currentTarget as HTMLDetailsElement).open)}>
          <summary>{t('device.moreBrands', { count: BRANDS_BY_POPULARITY.length - MAIN_BRANDS })}</summary>
          <div class="chips-more">
            {BRANDS_BY_POPULARITY.slice(MAIN_BRANDS).map((b) => (
              <BrandChip key={b} brand={b} checked={state.brands.includes(b)} onToggle={() => dispatch({ type: 'toggleBrand', brand: b })} />
            ))}
          </div>
        </details>
      </fieldset>

      <fieldset class="segmented" role="radiogroup">
        <legend>{t('device.colorFilter')}</legend>
        {(
          [
            ['any', 'device.colorAny'],
            ['color', 'device.colorColor'],
            ['grayscale', 'device.colorGray'],
          ] as const
        ).map(([value, key]) => (
          <label key={value}>
            <input
              type="radio"
              name="color-filter"
              value={value}
              checked={state.colorFilter === value}
              onChange={() => dispatch({ type: 'setColorFilter', value })}
            />
            <span>{t(key)}</span>
          </label>
        ))}
      </fieldset>
      {filtered && (
        <button type="button" class="link-button" onClick={() => dispatch({ type: 'clearFilters' })}>
          {t('device.clearFilters')}
        </button>
      )}

      <div class="device-list" role="radiogroup" aria-labelledby="device-title" data-testid="device-list">
        <label class={`device-option custom-option${state.deviceId === null ? ' selected' : ''}`}>
          <input type="radio" name="device" checked={state.deviceId === null} onChange={() => dispatch({ type: 'selectDevice', id: null })} />
          <span class="device-name">{t('device.custom')}</span>
          <span class="device-meta">{t('device.customHint')}</span>
        </label>
        {results.length === 0 && <p class="hint">{t('device.none')}</p>}
        {results.map((d) => (
          <label key={d.id} class={`device-option${state.deviceId === d.id ? ' selected' : ''}`} data-device={d.id}>
            <input type="radio" name="device" value={d.id} checked={state.deviceId === d.id} onChange={() => dispatch({ type: 'selectDevice', id: d.id })} />
            <span class="device-name">
              {displayName(d)}
              {d.color && <span class="dot" title={t('device.color')} aria-label={t('device.color')} />}
            </span>
            <span class="device-meta">
              <span class="gen">{generationLabel(d, tr)}</span>
              <span class="res">
                {d.resolution.width}×{d.resolution.height}
              </span>
            </span>
            <span class={`status-pip status-${deviceStatus(d)}`} title={t(`status.${deviceStatus(d)}`)} aria-hidden="true" />
          </label>
        ))}
      </div>
      {device === undefined && state.deviceId !== null && <p class="hint">{t('device.none')}</p>}
    </section>
  );
}
