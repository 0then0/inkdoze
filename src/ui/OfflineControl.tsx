import { useEffect, useRef, useState } from 'preact/hooks';
import { useI18n } from '../i18n/index.ts';
import { offlineStatus, type OfflineStatus } from '../offline/client.ts';
import { Icon } from './Icon.tsx';

export function OfflineControl() {
  const { t } = useI18n();
  const [status, setStatus] = useState<OfflineStatus | 'checking' | 'preparing'>('checking');
  const disclosure = useRef<HTMLDetailsElement>(null);
  const preparing = useRef(false);
  const statusRequest = useRef(0);
  useEffect(() => {
    let mounted = true;
    function refreshStatus() {
      if (preparing.current) return;
      const request = ++statusRequest.current;
      void offlineStatus().then((result) => {
        if (mounted && request === statusRequest.current) setStatus(result);
      });
    }
    const workers = navigator.serviceWorker;
    workers?.addEventListener('controllerchange', refreshStatus);
    refreshStatus();
    return () => {
      mounted = false;
      workers?.removeEventListener('controllerchange', refreshStatus);
    };
  }, []);

  useEffect(() => {
    const details = disclosure.current;
    if (!details) return;
    const dismissOutside = (event: PointerEvent) => {
      if (details.open && event.target instanceof Node && !details.contains(event.target)) details.open = false;
    };
    const dismissWithEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !details.open) return;
      event.preventDefault();
      details.open = false;
      details.querySelector('summary')?.focus();
    };
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('keydown', dismissWithEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('keydown', dismissWithEscape);
    };
  }, []);

  const prepare = async () => {
    preparing.current = true;
    statusRequest.current++;
    setStatus('preparing');
    try {
      setStatus(await offlineStatus(true));
    } finally {
      preparing.current = false;
    }
  };
  const label = status === 'ready' ? 'offline.update'
    : status === 'error' || status === 'storage' ? 'offline.retry' : 'offline.prepare';
  const ready = status === 'ready';
  return (
    <details
      class="offline-control"
      ref={disclosure}
      onFocusOut={({ currentTarget, relatedTarget }) => {
        if (relatedTarget instanceof Node && !currentTarget.contains(relatedTarget)) currentTarget.open = false;
      }}
    >
      <summary class="button small offline-toggle" tabIndex={0} aria-describedby={ready ? 'offline-status' : undefined}>
        {t('offline.menu')}
        <Icon name={ready ? 'check' : 'down'} size={15} />
      </summary>
      <div class="offline-panel">
        <p class="hint" id="offline-status" role="status" data-testid="offline-status">
          {status !== 'checking' && status !== 'idle' ? t(`offline.${status}`) : ''}
        </p>
        {status !== 'unsupported' && status !== 'waiting' && (
          <button class="button small" type="button" tabIndex={0} onClick={prepare} disabled={status === 'checking' || status === 'preparing'}>
            {t(label)}
          </button>
        )}
      </div>
    </details>
  );
}
