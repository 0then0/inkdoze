import { useI18n } from '../i18n/index.ts';
import { Icon } from './Icon.tsx';
import { Rich } from './InstallGuide.tsx';
import type { ImageItem } from './state.ts';

export interface Progress {
  done: number;
  total: number;
}

interface Props {
  selected: ImageItem | undefined;
  fileName: string | null;
  summary: string | null;
  readyCount: number;
  progress: Progress | null;
  message: string | null;
  onOne: () => void;
  onAll: () => void;
  onCancel: () => void;
}

export function DownloadPanel({ selected, fileName, summary, readyCount, progress, message, onOne, onAll, onCancel }: Props) {
  const { t } = useI18n();
  const busy = progress !== null;
  return (
    <section class="panel download-panel" aria-labelledby="download-title">
      <h2 id="download-title" class="sr-only">
        {t('download.title')}
      </h2>
      {summary && (
        <p class="small muted" data-testid="output-summary">
          {summary}
        </p>
      )}
      {fileName && (
        <p class="small file-name-preview">
          <Rich k="download.name" params={{ name: fileName }} code={['name']} />
        </p>
      )}
      <div class="download-buttons">
        <button type="button" class="button primary" disabled={busy || selected?.status !== 'ready'} onClick={onOne} data-testid="download-one">
          <Icon name="download" />
          {t('download.one')}
        </button>
        <button type="button" class="button" disabled={busy || readyCount === 0} onClick={onAll} data-testid="download-all">
          <Icon name="download" />
          {readyCount > 1 ? t('download.all', { count: readyCount }) : t('download.allOne')}
        </button>
      </div>
      {progress && (
        <div class="progress" role="status">
          <progress max={progress.total} value={progress.done} />
          <span class="small">{t('download.progress', { done: progress.done, total: progress.total })}</span>
          <button type="button" class="button ghost small" onClick={onCancel} data-testid="download-cancel">
            {t('download.cancel')}
          </button>
        </div>
      )}
      {message && (
        <p class="small muted" role="status" data-testid="download-message">
          {message}
        </p>
      )}
    </section>
  );
}
