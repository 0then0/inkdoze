import { useRef } from 'preact/hooks';
import { useI18n } from '../i18n/index.ts';
import { LIMITS } from '../io/limits.ts';
import { sanitizeBaseName } from '../io/names.ts';
import { Icon } from './Icon.tsx';
import { hasOverrides, type Action, type ImageItem } from './state.ts';

interface Props {
  images: ImageItem[];
  selectedId: string | null;
  extension: (item: ImageItem) => string;
  dispatch: (a: Action) => void;
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  onRemoveAll: () => void;
  notice: string | null;
}

export const ACCEPT = 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp';

export function FilePicker({ onAdd, label, primary }: { onAdd: (files: File[]) => void; label: string; primary?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" class={primary ? 'button primary' : 'button'} onClick={() => input.current?.click()}>
        <Icon name="plus" />
        {label}
      </button>
      <input
        ref={input}
        class="sr-only"
        type="file"
        multiple
        accept={ACCEPT}
        tabIndex={-1}
        aria-hidden="true"
        data-testid="file-input"
        onChange={(e) => {
          const files = [...(e.currentTarget.files ?? [])];
          e.currentTarget.value = '';
          if (files.length) onAdd(files);
        }}
      />
    </>
  );
}

export function FilesPanel({ images, selectedId, extension, dispatch, onAdd, onRemove, onRemoveAll, notice }: Props) {
  const { t, tp } = useI18n();
  return (
    <section class="panel files-panel" aria-labelledby="files-title">
      <div class="panel-head">
        <h2 id="files-title">{t('files.title')}</h2>
        <span class="muted small">{tp('files.count', images.length)}</span>
        <span class="spacer" />
        {images.length > 1 && (
          <button type="button" class="button ghost small" onClick={onRemoveAll}>
            {t('files.removeAll')}
          </button>
        )}
        <FilePicker onAdd={onAdd} label={t('files.add')} primary={images.length === 0} />
      </div>
      <p class="hint">
        {t('files.drop')} · {t('files.hint', { max: LIMITS.maxFiles, size: Math.round(LIMITS.maxFileBytes / 1048576) })}
      </p>
      {notice && (
        <p class="callout warn" role="status">
          {notice}
        </p>
      )}
      {images.length > 0 && (
        <ul class="file-list" data-testid="file-list">
          {images.map((item) => {
            const selected = item.id === selectedId;
            return (
              <li key={item.id} class={`file-item${selected ? ' selected' : ''}${item.status === 'error' ? ' has-error' : ''}`} data-status={item.status}>
                <button
                  type="button"
                  class="thumb"
                  aria-pressed={selected}
                  aria-label={t('files.select', { name: item.file.name })}
                  onClick={() => dispatch({ type: 'select', id: item.id })}
                >
                  {item.thumbUrl ? <img src={item.thumbUrl} alt="" /> : <Icon name="image" size={22} />}
                </button>
                <div class="file-body">
                  <div class="name-row">
                    <input
                      class="name-input"
                      type="text"
                      value={item.name}
                      aria-label={t('files.rename', { name: item.file.name })}
                      spellcheck={false}
                      onFocus={() => dispatch({ type: 'select', id: item.id })}
                      onInput={(e) => dispatch({ type: 'updateImage', id: item.id, patch: { name: e.currentTarget.value } })}
                      onBlur={(e) =>
                        dispatch({ type: 'updateImage', id: item.id, patch: { name: sanitizeBaseName(e.currentTarget.value) } })
                      }
                    />
                    <span class="ext">.{extension(item)}</span>
                  </div>
                  <div class="file-meta">
                    {item.status === 'loading' && <span class="muted">{t('files.loading')}</span>}
                    {item.status === 'ready' && (
                      <span class="muted">
                        {item.width} × {item.height}
                      </span>
                    )}
                    {hasOverrides(item) && (
                      <span class="tag" title={t('files.customTitle')}>
                        {t('files.custom')}
                      </span>
                    )}
                    {item.adjust.crop && <span class="tag">{t('adjust.cropped')}</span>}
                  </div>
                  {item.error && (
                    <p class="file-error" role="alert">
                      <Icon name="warn" size={14} /> {t(item.error.key, item.error.params)}
                    </p>
                  )}
                </div>
                <button type="button" class="icon-button" aria-label={t('files.remove', { name: item.file.name })} onClick={() => onRemove(item.id)}>
                  <Icon name="close" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
