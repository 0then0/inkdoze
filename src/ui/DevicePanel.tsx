import { BRANDS, deviceStatus, groupByBrand, searchDevices, type Device } from '../catalog/index.ts';
import type { Brand } from '../catalog/types.ts';
import { generationLabel, useI18n } from '../i18n/index.ts';
import { Icon } from './Icon.tsx';
import type { Action, AppState } from './state.ts';

interface Props {
  state: AppState;
  device: Device | undefined;
  dispatch: (a: Action) => void;
}

export function DevicePanel({ state, device, dispatch }: Props) {
  const tr = useI18n();
  const { t, tp } = tr;
  const results = searchDevices({ query: state.query, brands: state.brands, color: state.colorFilter });
  const groups = groupByBrand(results);
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
        {BRANDS.map((b: Brand) => (
          <label key={b} class="chip">
            <input type="checkbox" checked={state.brands.includes(b)} onChange={() => dispatch({ type: 'toggleBrand', brand: b })} />
            <span>{b}</span>
          </label>
        ))}
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
        {groups.length === 0 && <p class="hint">{t('device.none')}</p>}
        {groups.map(([brand, list]) => (
          <div class="device-group" key={brand} role="group" aria-label={brand}>
            <h3>{brand}</h3>
            {list.map((d) => (
              <label key={d.id} class={`device-option${state.deviceId === d.id ? ' selected' : ''}`} data-device={d.id}>
                <input type="radio" name="device" value={d.id} checked={state.deviceId === d.id} onChange={() => dispatch({ type: 'selectDevice', id: d.id })} />
                <span class="device-name">
                  {d.model}
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
        ))}
      </div>
      {device === undefined && state.deviceId !== null && <p class="hint">{t('device.none')}</p>}
    </section>
  );
}
