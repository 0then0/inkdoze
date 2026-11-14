import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'preact/hooks';
import { deviceMethods, getDevice } from '../catalog/index.ts';
import type { InstallMethod } from '../catalog/types.ts';
import { EPUB_MIME, createCoverEpub, epubImageFormat } from '../formats/epub.ts';
import { FORMATS, resolveFormat } from '../formats/registry.ts';
import { createZip } from '../formats/zip.ts';
import { I18nContext, LOCALES, LOCALE_NAMES, createTranslator, matchLocale, type Locale } from '../i18n/index.ts';
import { LIMITS } from '../io/limits.ts';
import { sanitizeBaseName, stripExtension, uniqueNames } from '../io/names.ts';
import { AbortedError, TaskQueue, isAbort } from '../io/queue.ts';
import { rotatedSize } from '../pipeline/geometry.ts';
import { buildJob } from '../pipeline/job.ts';
import { DEFAULT_ADJUST, type Adjustments, type NormRect, type RenderJob } from '../pipeline/types.ts';
import { RenderClient, WorkerError } from '../worker/client.ts';
import { CropDialog } from './CropDialog.tsx';
import { DevicePanel } from './DevicePanel.tsx';
import { DownloadPanel, type Progress } from './DownloadPanel.tsx';
import { FilesPanel } from './FilesPanel.tsx';
import { Logo } from './Icon.tsx';
import { InstallGuide } from './InstallGuide.tsx';
import { PreviewStage, type PreviewFrame } from './PreviewStage.tsx';
import { SettingsPanel } from './SettingsPanel.tsx';
import { effectiveSettings, initialState, reducer, type AppState, type ImageItem } from './state.ts';
import { saveBlob } from './save.ts';

const LOCALE_KEY = 'inkdoze.locale';
const DEVICE_KEY = 'inkdoze.device';
const CUSTOM_DEVICE = 'custom';

/** Start with the e-reader chosen on the previous visit, so returning users only add images and download. */
function initState(): AppState {
  try {
    const saved = localStorage.getItem(DEVICE_KEY);
    if (saved === CUSTOM_DEVICE) return reducer(initialState, { type: 'selectDevice', id: null });
    if (saved && getDevice(saved)) return reducer(initialState, { type: 'selectDevice', id: saved });
  } catch {
    // Storage can be unavailable; fall back to the default e-reader.
  }
  return initialState;
}

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(LOCALE_KEY);
    if (saved && (LOCALES as readonly string[]).includes(saved)) return saved as Locale;
  } catch {
    // Storage can be unavailable (private mode); fall back to the browser languages.
  }
  return matchLocale(navigator.languages ?? [navigator.language]);
}

function supported(): boolean {
  return typeof OffscreenCanvas !== 'undefined' && typeof Worker !== 'undefined' && typeof createImageBitmap !== 'undefined';
}

function errorFor(e: unknown): ImageItem['error'] {
  if (e instanceof WorkerError) {
    switch (e.code) {
      case 'unsupported':
        return { key: 'error.unsupported' };
      case 'corrupt':
        return { key: 'error.corrupt' };
      case 'tooManyPixels':
        return { key: 'error.tooManyPixels', params: { dims: e.detail ?? '', max: LIMITS.maxInputPixels / 1e6 } };
      case 'decode':
        return { key: 'error.decode' };
    }
  }
  return { key: 'error.render' };
}

export function App() {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const tr = useMemo(() => createTranslator(locale), [locale]);
  const { t, tp } = tr;
  const [state, dispatch] = useReducer(reducer, undefined, initState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const [client] = useState(() => (supported() ? new RenderClient() : null));
  const queue = useMemo(() => new TaskQueue(LIMITS.concurrency), []);
  const loads = useRef(new Map<string, AbortController>());

  const [notice, setNotice] = useState<string | null>(null);
  const [frame, setFrame] = useState<PreviewFrame | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const exportAbort = useRef<AbortController | null>(null);
  const [dragging, setDragging] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropFrame, setCropFrame] = useState<PreviewFrame | null>(null);
  const cropAbort = useRef<AbortController | null>(null);

  const device = state.deviceId ? getDevice(state.deviceId) : undefined;
  const methods = device ? deviceMethods(device) : [];
  const method: InstallMethod | undefined = methods.find((m) => m.id === state.methodId) ?? methods[0];
  const selected = state.images.find((i) => i.id === state.selectedId);
  const selectedIndex = state.images.findIndex((i) => i.id === state.selectedId);
  const settings = effectiveSettings(state, selected);
  const readyCount = state.images.filter((i) => i.status === 'ready').length;

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = `InkDoze · ${tr.t('app.tagline')}`;
    try {
      localStorage.setItem(LOCALE_KEY, locale);
    } catch {
      // Ignore storage failures.
    }
  }, [locale, tr]);

  useEffect(() => {
    try {
      localStorage.setItem(DEVICE_KEY, state.deviceId ?? CUSTOM_DEVICE);
    } catch {
      // Ignore storage failures.
    }
  }, [state.deviceId]);

  const formatFor = useCallback((item: ImageItem | undefined) => resolveFormat(effectiveSettings(stateRef.current, item).format, method), [method]);
  const extensionFor = useCallback((item: ImageItem) => FORMATS[formatFor(item)].extension, [formatFor]);

  const jobFor = useCallback(
    (item: ImageItem): RenderJob | null => {
      const s = effectiveSettings(stateRef.current, item);
      const r = buildJob({ width: item.width, height: item.height }, s, item.adjust, device, resolveFormat(s.format, method));
      return r.ok ? r.job : null;
    },
    [device, method],
  );

  // ---------------------------------------------------------------- files
  const addFiles = useCallback(
    (files: File[]) => {
      setNotice(null);
      const room = LIMITS.maxFiles - stateRef.current.images.length;
      const accepted = files.slice(0, Math.max(0, room));
      if (accepted.length < files.length) {
        setNotice(tr.t('files.tooMany', { max: LIMITS.maxFiles, skipped: files.length - accepted.length }));
      }
      if (!accepted.length) return;
      const items: ImageItem[] = accepted.map((file) => {
        const tooLarge = file.size > LIMITS.maxFileBytes;
        return {
          id: crypto.randomUUID(),
          file,
          name: sanitizeBaseName(stripExtension(file.name)),
          status: tooLarge ? 'error' : 'loading',
          ...(tooLarge ? { error: { key: 'error.tooLarge', params: { size: Math.round(LIMITS.maxFileBytes / 1048576) } } } : {}),
          width: 0,
          height: 0,
          overrides: {},
          adjust: DEFAULT_ADJUST,
        } satisfies ImageItem;
      });
      dispatch({ type: 'addImages', items });
      if (!client) return;
      for (const item of items) {
        if (item.status !== 'loading') continue;
        const ctrl = new AbortController();
        loads.current.set(item.id, ctrl);
        queue
          .run((signal) => client.load(item.id, item.file, signal), ctrl.signal)
          .then((r) => {
            dispatch({
              type: 'updateImage',
              id: item.id,
              patch: { status: 'ready', width: r.width, height: r.height, thumbUrl: URL.createObjectURL(r.thumbnail) },
            });
          })
          .catch((e: unknown) => {
            if (isAbort(e)) return;
            const error = errorFor(e);
            dispatch({ type: 'updateImage', id: item.id, patch: { status: 'error', ...(error ? { error } : {}) } });
          })
          .finally(() => loads.current.delete(item.id));
      }
    },
    [client, queue, tr],
  );

  const removeImage = useCallback(
    (id: string) => {
      loads.current.get(id)?.abort();
      const item = stateRef.current.images.find((i) => i.id === id);
      if (item?.thumbUrl) URL.revokeObjectURL(item.thumbUrl);
      client?.release(id);
      dispatch({ type: 'removeImage', id });
    },
    [client],
  );

  const removeAll = useCallback(() => {
    for (const item of stateRef.current.images) {
      loads.current.get(item.id)?.abort();
      if (item.thumbUrl) URL.revokeObjectURL(item.thumbUrl);
      client?.release(item.id);
    }
    dispatch({ type: 'removeAll' });
  }, [client]);

  // Window-wide drag and drop.
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].includes('Files');
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const leave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      addFiles([...(e.dataTransfer?.files ?? [])]);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, [addFiles]);

  // ---------------------------------------------------------------- preview
  const previewKey = selected && selected.status === 'ready' ? JSON.stringify([selected.id, jobFor(selected)]) : null;
  useEffect(() => {
    setPreviewError(null);
    if (!client || !selected || selected.status !== 'ready') {
      setFrame((old) => {
        old?.bitmap.close();
        return null;
      });
      setPreviewBusy(false);
      return;
    }
    const job = jobFor(selected);
    if (!job) {
      setFrame((old) => {
        old?.bitmap.close();
        return null;
      });
      setPreviewError(tr.t('error.outputTooLarge', { max: LIMITS.maxOutputSide }));
      return;
    }
    const ctrl = new AbortController();
    setPreviewBusy(true);
    const timer = setTimeout(() => {
      client
        .preview(selected.id, job, ctrl.signal)
        .then((r) => {
          setFrame((old) => {
            old?.bitmap.close();
            return { bitmap: r.bitmap, width: r.width, height: r.height };
          });
          setPreviewBusy(false);
        })
        .catch((e: unknown) => {
          if (isAbort(e)) return;
          setPreviewBusy(false);
          setPreviewError(tr.t('error.render'));
        });
    }, 40);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // previewKey captures every input of the job.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey, client, tr]);

  // ---------------------------------------------------------------- crop
  const openCrop = useCallback(() => {
    if (!client || !selected || selected.status !== 'ready') return;
    cropAbort.current?.abort();
    const ctrl = new AbortController();
    cropAbort.current = ctrl;
    setCropFrame(null);
    setCropOpen(true);
    const space = rotatedSize({ width: selected.width, height: selected.height }, selected.adjust.rotation);
    const scale = Math.min(1, 1000 / Math.max(space.width, space.height));
    const job: RenderJob = {
      target: { width: Math.max(1, Math.round(space.width * scale)), height: Math.max(1, Math.round(space.height * scale)) },
      rotation: selected.adjust.rotation,
      crop: null,
      fit: 'stretch',
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      background: '#ffffff',
      colorMode: 'color',
      autoTone: false,
      brightness: 0,
      contrast: 0,
      invert: false,
      levels: 256,
      dither: 'none',
    };
    client
      .preview(selected.id, job, ctrl.signal)
      .then((r) => setCropFrame({ bitmap: r.bitmap, width: r.width, height: r.height }))
      .catch((e: unknown) => {
        if (!isAbort(e)) setCropOpen(false);
      });
  }, [client, selected]);

  const closeCrop = () => {
    // An unfinished render is discarded; the client closes its bitmap when it arrives.
    cropAbort.current?.abort();
    cropAbort.current = null;
    cropFrame?.bitmap.close();
    setCropFrame(null);
    setCropOpen(false);
  };

  // ---------------------------------------------------------------- export
  const outputName = (item: ImageItem) => `${sanitizeBaseName(item.name)}.${extensionFor(item)}`;

  const downloadOne = async () => {
    const item = selected;
    if (!client || !item || item.status !== 'ready') return;
    const job = jobFor(item);
    if (!job) return setMessage(t('error.outputTooLarge', { max: LIMITS.maxOutputSide }));
    const ctrl = new AbortController();
    exportAbort.current = ctrl;
    setMessage(null);
    setProgress({ done: 0, total: 1 });
    try {
      const s = effectiveSettings(stateRef.current, item);
      const r = await queue.run((signal) => client.export(item.id, job, resolveFormat(s.format, method), s.jpegQuality, signal), ctrl.signal);
      const name = outputName(item);
      saveBlob(r.blob, name);
      setMessage(t('download.done', { name }));
    } catch (e) {
      setMessage(isAbort(e) ? t('download.cancelled') : t('error.render'));
    } finally {
      setProgress(null);
      exportAbort.current = null;
    }
  };

  /**
   * One EPUB whose cover is the selected image, rendered by the same pipeline as the image
   * export. Everything the result depends on is captured before rendering starts, so changing
   * the image, settings or e-reader meanwhile cannot mix into the file or its metadata.
   */
  const downloadEpub = async () => {
    const item = selected;
    if (!client || !item || item.status !== 'ready') return;
    const s = effectiveSettings(stateRef.current, item);
    // Tone follows the chosen format, as in the preview (a 2-bit BMP keeps its 4 grays);
    // only the container encoding switches to PNG or JPEG.
    const chosen = resolveFormat(s.format, method);
    const format = epubImageFormat(chosen);
    const built = buildJob({ width: item.width, height: item.height }, s, item.adjust, device, chosen);
    if (!built.ok) return setMessage(t('error.outputTooLarge', { max: LIMITS.maxOutputSide }));
    const base = sanitizeBaseName(item.name);
    const fileName = `${base}.epub`;
    const title = item.name.trim() || base;
    const language = locale;
    const ctrl = new AbortController();
    exportAbort.current = ctrl;
    setMessage(null);
    setProgress({ done: 0, total: 1 });
    try {
      const r = await queue.run((signal) => client.export(item.id, built.job, format, s.jpegQuality, signal), ctrl.signal);
      const data = new Uint8Array(await r.blob.arrayBuffer());
      if (ctrl.signal.aborted) throw new AbortedError();
      const epub = createCoverEpub({
        title,
        language,
        identifier: `urn:uuid:${crypto.randomUUID()}`,
        modified: new Date(),
        image: { data, format },
      });
      saveBlob(new Blob(epub as BlobPart[], { type: EPUB_MIME }), fileName);
      setMessage(t('download.done', { name: fileName }));
    } catch (e) {
      setMessage(isAbort(e) ? t('download.cancelled') : t('error.render'));
    } finally {
      setProgress(null);
      exportAbort.current = null;
    }
  };

  const downloadAll = async () => {
    if (!client) return;
    const items = stateRef.current.images.filter((i) => i.status === 'ready');
    if (!items.length) return setMessage(t('download.nothing'));
    const ctrl = new AbortController();
    exportAbort.current = ctrl;
    setMessage(null);
    let done = 0;
    let failed = 0;
    setProgress({ done, total: items.length });
    const names = uniqueNames(items.map(outputName));
    try {
      const results = await Promise.all(
        items.map(async (item, i) => {
          const job = jobFor(item);
          try {
            if (!job) throw new Error('outputTooLarge');
            const s = effectiveSettings(stateRef.current, item);
            const r = await queue.run((signal) => client.export(item.id, job, resolveFormat(s.format, method), s.jpegQuality, signal), ctrl.signal);
            const data = new Uint8Array(await r.blob.arrayBuffer());
            return { name: names[i] ?? `image-${i + 1}`, data };
          } catch (e) {
            if (isAbort(e)) throw e;
            failed++;
            return null;
          } finally {
            done++;
            if (!ctrl.signal.aborted) setProgress({ done, total: items.length });
          }
        }),
      );
      const entries = results.filter((r) => r !== null);
      if (!entries.length) {
        setMessage(t('download.nothing'));
        return;
      }
      const zip = createZip(entries);
      const zipName = `inkdoze-${device?.id ?? 'custom'}.zip`;
      saveBlob(new Blob(zip as BlobPart[], { type: 'application/zip' }), zipName);
      setMessage(failed ? tp('download.failed', failed) : t('download.done', { name: zipName }));
    } catch (e) {
      setMessage(isAbort(e) ? t('download.cancelled') : t('error.render'));
    } finally {
      setProgress(null);
      exportAbort.current = null;
    }
  };

  const cancelExport = () => exportAbort.current?.abort();

  // What the download will contain, so the defaults can be trusted without opening the settings.
  const summary = (() => {
    if (!selected || selected.status !== 'ready') return null;
    const job = jobFor(selected);
    if (!job) return null;
    return [
      t('preview.size', { w: String(job.target.width), h: String(job.target.height) }),
      t(`format.${formatFor(selected)}`),
      t(job.colorMode === 'color' ? 'settings.color' : 'settings.grayscale'),
    ].join(' · ');
  })();

  // ---------------------------------------------------------------- render
  const step = (delta: number) => {
    const list = stateRef.current.images;
    if (!list.length) return;
    const i = (selectedIndex + delta + list.length) % list.length;
    dispatch({ type: 'select', id: list[i]?.id ?? null });
  };

  const setAdjust = (patch: Partial<Adjustments>) => selected && dispatch({ type: 'setAdjust', id: selected.id, patch });

  const cropAspect = (() => {
    if (!selected || selected.status !== 'ready') return 1;
    const job = jobFor(selected);
    return job ? job.target.width / job.target.height : 1;
  })();

  if (!client) {
    return (
      <I18nContext.Provider value={tr}>
        <main class="unsupported">
          <p role="alert">{t('error.noWorker')}</p>
        </main>
      </I18nContext.Provider>
    );
  }

  return (
    <I18nContext.Provider value={tr}>
      <a class="skip-link" href="#preview">
        {t('app.skip')}
      </a>
      <header class="topbar">
        <div class="brand">
          <Logo />
          <div>
            <h1>InkDoze</h1>
            <p class="tagline">{t('app.tagline')}</p>
          </div>
        </div>
        <p class="offline small">{t('app.offline')}</p>
        <label class="lang">
          <span class="sr-only">{t('app.language')}</span>
          <select value={locale} data-testid="locale" aria-label={t('app.language')} onChange={(e) => setLocale(e.currentTarget.value as Locale)}>
            {LOCALES.map((l) => (
              <option key={l} value={l} lang={l}>
                {LOCALE_NAMES[l]}
              </option>
            ))}
          </select>
        </label>
      </header>

      <main class="layout">
        <div class="col col-device">
          <DevicePanel state={state} device={device} dispatch={dispatch} />
          <InstallGuide
            device={device}
            method={method}
            onMethod={(id) => dispatch({ type: 'selectMethod', id })}
            onUseName={selected ? (name) => dispatch({ type: 'updateImage', id: selected.id, patch: { name } }) : undefined}
          />
        </div>
        <div class="col col-work">
          <PreviewStage
            item={selected}
            index={selectedIndex}
            total={state.images.length}
            frame={frame}
            busy={previewBusy}
            error={previewError ?? (selected?.error ? t(selected.error.key, selected.error.params) : null)}
            onAdjust={setAdjust}
            onResetAdjust={() => selected && dispatch({ type: 'resetAdjust', id: selected.id })}
            onCrop={openCrop}
            onStep={step}
            onAdd={addFiles}
          />
          <FilesPanel
            images={state.images}
            selectedId={state.selectedId}
            extension={extensionFor}
            dispatch={dispatch}
            onAdd={addFiles}
            onRemove={removeImage}
            onRemoveAll={removeAll}
            notice={notice}
          />
        </div>
        <div class="col col-output">
          <SettingsPanel settings={settings} scope={state.scope} selected={selected} device={device} method={method} dispatch={dispatch} />
          <DownloadPanel
            selected={selected}
            fileName={selected ? outputName(selected) : null}
            summary={summary}
            readyCount={readyCount}
            progress={progress}
            message={message}
            epub={method?.coverEpub === true}
            onOne={downloadOne}
            onEpub={downloadEpub}
            onAll={downloadAll}
            onCancel={cancelExport}
          />
        </div>
      </main>

      {dragging && (
        <div class="drop-overlay" aria-hidden="true">
          <p>{t('files.dropActive')}</p>
        </div>
      )}

      {cropOpen && selected && (
        <CropDialog
          frame={cropFrame}
          space={rotatedSize({ width: selected.width, height: selected.height }, selected.adjust.rotation)}
          aspect={cropAspect}
          initial={selected.adjust.crop}
          onApply={(crop: NormRect | null) => {
            setAdjust({ crop, zoom: 1, offsetX: 0, offsetY: 0 });
            closeCrop();
          }}
          onClose={closeCrop}
        />
      )}
    </I18nContext.Provider>
  );
}
