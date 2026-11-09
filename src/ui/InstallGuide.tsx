import { deviceMethods, deviceStatus, sameResolution, type Device, type InstallMethod } from '../catalog/index.ts';
import type { InstallStep, Source } from '../catalog/types.ts';
import { FORMATS } from '../formats/registry.ts';
import { generationLabel, useI18n } from '../i18n/index.ts';
import type { TextKey } from '../i18n/keys.ts';
import { Icon } from './Icon.tsx';

interface Props {
  device: Device | undefined;
  method: InstallMethod | undefined;
  onMethod: (id: string) => void;
  onUseName: ((name: string) => void) | undefined;
}

/**
 * Translated sentence with literal values inserted. Values listed in `code` (paths,
 * menus, file names) render as code; the rest as plain text.
 */
export function Rich({ k, params, code }: { k: TextKey; params: Record<string, string>; code?: readonly string[] }) {
  const { t } = useI18n();
  const marker = '\u0000';
  const tagged: Record<string, string> = {};
  for (const n of Object.keys(params)) tagged[n] = `${marker}${n}${marker}`;
  const parts = t(k, tagged).split(marker);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0 || !(part in params)) return part;
        return code === undefined || code.includes(part) ? <code key={i}>{params[part]}</code> : params[part];
      })}
    </>
  );
}

function Step({ step }: { step: InstallStep }) {
  return <Rich k={step.key as TextKey} params={step.params ?? {}} />;
}

function SourceList({ sources }: { sources: Source[] }) {
  const { t } = useI18n();
  return (
    <ul class="sources">
      {sources.map((s) => (
        <li key={s.url}>
          <span class={`kind kind-${s.kind}`}>{t(`install.sourceKind.${s.kind}`)}</span>
          <a href={s.url} target="_blank" rel="noopener noreferrer">
            {s.title}
            <Icon name="external" size={12} />
          </a>
        </li>
      ))}
    </ul>
  );
}

export function InstallGuide({ device, method, onMethod, onUseName }: Props) {
  const tr = useI18n();
  const { t, formatDate } = tr;
  if (!device) return null;
  const methods = deviceMethods(device);
  const status = deviceStatus(device);
  const secondaryOnly = device.sources.every((s) => s.kind === 'secondary');
  const same = [...new Set(sameResolution(device).map((d) => `${d.brand} ${d.model}`))].slice(0, 6);
  const fileName = method?.recommendedFormat
    ? `${method.fileName ?? 'image'}.${FORMATS[method.recommendedFormat].extension}`
    : undefined;

  return (
    <section class="panel install-panel" aria-labelledby="install-title" data-testid="install-guide">
      <div class="device-card">
        <p class="eyebrow">{t('device.selected')}</p>
        <h2 id="install-title">
          {device.brand} {device.model}
        </h2>
        <p class="muted">{generationLabel(device, tr)}</p>
        <dl class="facts">
          <div>
            <dt>{t('device.resolution')}</dt>
            <dd data-testid="device-resolution">{t('device.portrait', { w: String(device.resolution.width), h: String(device.resolution.height) })}</dd>
          </div>
          <div>
            <dt>{t('device.colorFilter')}</dt>
            <dd>{device.color ? t('device.color') : t('device.grayscale')}</dd>
          </div>
        </dl>
        <p class={`badge status-${status}`}>{t(`status.${status}`)}</p>
        {secondaryOnly && (
          <p class="badge warn">
            <Icon name="warn" size={14} /> {t('status.secondary')}
          </p>
        )}
        {device.notes?.map((n) => (
          <p class="note" key={n.key}>
            <Icon name="info" size={14} />
            <span>
              <Step step={n} />
            </span>
          </p>
        ))}
        {same.length > 0 && <p class="hint">{t('device.sameSize', { list: same.join(', ') })}</p>}
      </div>

      <h3 class="section-title">{t('install.title')}</h3>
      {methods.length === 0 && <p class="callout">{t('install.sizeOnly')}</p>}
      {methods.length > 1 && (
        <fieldset class="method-tabs">
          <legend class="sr-only">{t('install.methods')}</legend>
          {methods.map((m) => (
            <label key={m.id} class={m.id === method?.id ? 'selected' : ''}>
              <input type="radio" name="install-method" checked={m.id === method?.id} onChange={() => onMethod(m.id)} />
              <span>{t(`method.${m.id}` as TextKey)}</span>
            </label>
          ))}
        </fieldset>
      )}
      {method && (
        <div class="method" data-testid="install-method" data-method={method.id}>
          <p class="method-tags">
            <span class={`badge status-${method.status}`}>{t(`status.${method.status}`)}</span>
            {method.communityDocumented && <span class="badge community">{t('status.community')}</span>}
          </p>
          <p class="small">
            <Rich k="install.software" params={{ name: t(`method.${method.id}` as TextKey) }} code={[]} />
          </p>
          {method.status === 'cover-only' && <p class="callout">{t('install.coverOnlyHint')}</p>}
          {fileName && method.recommendedFormat && (
            <div class="recommend">
              <p class="small">
                <Rich k="install.format" params={{ file: fileName, format: t(`format.${method.recommendedFormat}`) }} code={['file']} />
              </p>
              {method.formats.length > 0 && (
                <p class="hint">{t('install.formats', { list: method.formats.map((f) => t(`format.${f}`)).join('; ') })}</p>
              )}
              {method.fileName && onUseName && (
                <button type="button" class="link-button" onClick={() => onUseName(method.fileName ?? '')}>
                  {t('install.useName', { name: fileName })}
                </button>
              )}
            </div>
          )}
          <h4>{t('install.steps')}</h4>
          <ol class="steps">
            {method.steps.map((s) => (
              <li key={s.key}>
                <Step step={s} />
              </li>
            ))}
          </ol>
          {method.limitations.length > 0 && (
            <>
              <h4>{t('install.limits')}</h4>
              <ul class="limits">
                {method.limitations.map((s) => (
                  <li key={s.key}>
                    <Step step={s} />
                  </li>
                ))}
              </ul>
            </>
          )}
          <details class="sources-box">
            <summary>
              {t('install.sources')} · {t('install.verified', { date: formatDate(method.verified) })}
            </summary>
            <SourceList sources={method.sources} />
          </details>
        </div>
      )}
      <details class="sources-box">
        <summary>
          {t('device.resolution')} · {t('install.verified', { date: formatDate(device.verified) })}
        </summary>
        <SourceList sources={device.sources} />
      </details>
    </section>
  );
}
