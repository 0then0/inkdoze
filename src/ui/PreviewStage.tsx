import { useEffect, useRef, useState } from 'preact/hooks';
import { useI18n } from '../i18n/index.ts';
import { MAX_ZOOM, MIN_ZOOM } from '../pipeline/geometry.ts';
import type { Adjustments, Rotation } from '../pipeline/types.ts';
import { FilePicker } from './FilesPanel.tsx';
import { Icon } from './Icon.tsx';
import type { ImageItem } from './state.ts';

export interface PreviewFrame {
  bitmap: ImageBitmap;
  width: number;
  height: number;
}

interface Props {
  item: ImageItem | undefined;
  index: number;
  total: number;
  frame: PreviewFrame | null;
  busy: boolean;
  error: string | null;
  onAdjust: (patch: Partial<Adjustments>) => void;
  onResetAdjust: () => void;
  onCrop: () => void;
  onStep: (delta: number) => void;
  onAdd: (files: File[]) => void;
}

const rotate = (r: Rotation, delta: 90 | -90): Rotation => (((r + delta + 360) % 360) as Rotation);

function Slider(props: { id: string; label: string; min: number; max: number; step: number; value: number; display: string; onChange: (v: number) => void }) {
  return (
    <div class="slider">
      <label for={props.id}>{props.label}</label>
      <input
        id={props.id}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onInput={(e) => props.onChange(Number(e.currentTarget.value))}
      />
      <output for={props.id}>{props.display}</output>
    </div>
  );
}

export function PreviewStage({ item, index, total, frame, busy, error, onAdjust, onResetAdjust, onCrop, onStep, onAdd }: Props) {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [simulate, setSimulate] = useState(false);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !frame) return;
    c.width = frame.width;
    c.height = frame.height;
    const ctx = c.getContext('2d');
    ctx?.drawImage(frame.bitmap, 0, 0);
  }, [frame]);

  const ready = item?.status === 'ready';
  const a = item?.adjust;

  return (
    <section class="panel stage" aria-labelledby="preview-title" id="preview">
      <div class="panel-head">
        <h2 id="preview-title">{t('preview.title')}</h2>
        {frame && (
          <span class="muted small" data-testid="preview-size">
            {t('preview.size', { w: String(frame.width), h: String(frame.height) })}
          </span>
        )}
        <span class="spacer" />
        {total > 1 && (
          <div class="pager">
            <button type="button" class="icon-button" aria-label={t('preview.prev')} onClick={() => onStep(-1)}>
              <Icon name="left" />
            </button>
            <span class="small" aria-live="polite">
              {t('preview.position', { index: index + 1, total })}
            </span>
            <button type="button" class="icon-button" aria-label={t('preview.next')} onClick={() => onStep(1)}>
              <Icon name="right" />
            </button>
          </div>
        )}
        <label class="toggle" title={t('preview.simulateNote')}>
          <input type="checkbox" checked={simulate} onChange={(e) => setSimulate(e.currentTarget.checked)} />
          <span>{t('preview.simulate')}</span>
        </label>
      </div>
      {simulate && <p class="hint sim-note">{t('preview.simulateNote')}</p>}

      <div class={`canvas-wrap${simulate ? ' simulate' : ''}`} aria-busy={busy}>
        {!item && (
          <div class="empty">
            <p class="empty-title">{t('preview.empty')}</p>
            <p class="hint">{t('preview.emptyHint')}</p>
            <FilePicker onAdd={onAdd} label={t('files.add')} primary />
          </div>
        )}
        {item && frame && (
          <canvas
            ref={canvas}
            data-testid="preview-canvas"
            role="img"
            aria-label={t('preview.alt', { name: item.file.name, w: String(frame.width), h: String(frame.height) })}
            style={{ aspectRatio: `${frame.width} / ${frame.height}` }}
          />
        )}
        {item && error && (
          <p class="file-error" role="alert">
            <Icon name="warn" size={14} /> {error}
          </p>
        )}
        {busy && <span class="busy">{t('preview.rendering')}</span>}
      </div>

      {item && a && (
        <div class="adjust" role="group" aria-labelledby="adjust-title">
          <h3 id="adjust-title" class="sr-only">
            {t('adjust.title')}
          </h3>
          <div class="adjust-buttons">
            <button type="button" class="icon-button" aria-label={t('adjust.rotateLeft')} title={t('adjust.rotateLeft')} disabled={!ready} onClick={() => onAdjust({ rotation: rotate(a.rotation, -90), crop: null })}>
              <Icon name="rotateLeft" />
            </button>
            <button type="button" class="icon-button" aria-label={t('adjust.rotateRight')} title={t('adjust.rotateRight')} disabled={!ready} onClick={() => onAdjust({ rotation: rotate(a.rotation, 90), crop: null })}>
              <Icon name="rotateRight" />
            </button>
            <button type="button" class="button small" disabled={!ready} onClick={onCrop}>
              <Icon name="crop" />
              {t('adjust.crop')}
            </button>
            <button type="button" class="button ghost small" disabled={!ready} onClick={onResetAdjust}>
              <Icon name="reset" />
              {t('adjust.reset')}
            </button>
          </div>
          <Slider id="zoom" label={t('adjust.zoom')} min={MIN_ZOOM} max={4} step={0.01} value={a.zoom} display={`${Math.round(a.zoom * 100)}%`} onChange={(v) => onAdjust({ zoom: Math.min(MAX_ZOOM, v) })} />
          <Slider id="offset-x" label={t('adjust.offsetX')} min={-1} max={1} step={0.01} value={a.offsetX} display={`${Math.round(a.offsetX * 100)}`} onChange={(v) => onAdjust({ offsetX: v })} />
          <Slider id="offset-y" label={t('adjust.offsetY')} min={-1} max={1} step={0.01} value={a.offsetY} display={`${Math.round(a.offsetY * 100)}`} onChange={(v) => onAdjust({ offsetY: v })} />
        </div>
      )}
    </section>
  );
}
