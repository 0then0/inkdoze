import { useEffect, useRef, useState } from 'preact/hooks';
import { useI18n } from '../i18n/index.ts';
import { MIN_CROP, clampCrop, fitCropToAspect } from '../pipeline/geometry.ts';
import type { NormRect, Size } from '../pipeline/types.ts';
import type { PreviewFrame } from './PreviewStage.tsx';

interface Props {
  frame: PreviewFrame | null;
  /** Rotated source size in pixels; crop rects are normalized against it. */
  space: Size;
  /** Output aspect ratio (width / height) in pixels. */
  aspect: number;
  initial: NormRect | null;
  onApply: (crop: NormRect | null) => void;
  onClose: () => void;
}

type Corner = 'nw' | 'ne' | 'sw' | 'se';
const FULL: NormRect = { x: 0, y: 0, w: 1, h: 1 };
const STEP = 0.01;

/** Resize from a corner, keeping the opposite corner fixed and, if locked, the aspect ratio. */
export function resizeFromCorner(start: NormRect, corner: Corner, px: number, py: number, normAspect: number | null): NormRect {
  const fx = corner.includes('w') ? start.x + start.w : start.x;
  const fy = corner.includes('n') ? start.y + start.h : start.y;
  const cx = Math.min(1, Math.max(0, px));
  const cy = Math.min(1, Math.max(0, py));
  let w = Math.max(MIN_CROP, Math.abs(cx - fx));
  let h = Math.max(MIN_CROP, Math.abs(cy - fy));
  if (normAspect) {
    if (w / h > normAspect) w = h * normAspect;
    else h = w / normAspect;
    // Keep inside the image on the free sides.
    const maxW = corner.includes('w') ? fx : 1 - fx;
    const maxH = corner.includes('n') ? fy : 1 - fy;
    if (w > maxW) {
      w = maxW;
      h = w / normAspect;
    }
    if (h > maxH) {
      h = maxH;
      w = h * normAspect;
    }
  }
  const x = corner.includes('w') ? fx - w : fx;
  const y = corner.includes('n') ? fy - h : fy;
  return clampCrop({ x, y, w, h });
}

export function CropDialog({ frame, space, aspect, initial, onApply, onClose }: Props) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const [lock, setLock] = useState(true);
  const normAspect = (aspect * space.height) / space.width;
  const [rect, setRect] = useState<NormRect>(() => initial ?? fitCropToAspect(FULL, space, aspect));
  const drag = useRef<{ mode: 'move' | Corner; startX: number; startY: number; start: NormRect } | null>(null);

  useEffect(() => {
    const d = dialog.current;
    // Return focus to the control that opened the dialog when it goes away.
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (d && !d.open) d.showModal();
    return () => {
      if (d?.open) d.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !frame) return;
    c.width = frame.width;
    c.height = frame.height;
    c.getContext('2d')?.drawImage(frame.bitmap, 0, 0);
  }, [frame]);

  const toggleLock = (on: boolean) => {
    setLock(on);
    if (on) setRect((r) => fitCropToAspect(r, space, aspect));
  };

  const point = (e: PointerEvent): [number, number] => {
    const box = area.current?.getBoundingClientRect();
    if (!box) return [0, 0];
    return [(e.clientX - box.left) / box.width, (e.clientY - box.top) / box.height];
  };

  const onPointerDown = (mode: 'move' | Corner) => (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const [x, y] = point(e);
    drag.current = { mode, startX: x, startY: y, start: rect };
  };

  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const [x, y] = point(e);
    if (d.mode === 'move') {
      setRect(clampCrop({ ...d.start, x: d.start.x + x - d.startX, y: d.start.y + y - d.startY }));
    } else {
      setRect(resizeFromCorner(d.start, d.mode, x, y, lock ? normAspect : null));
    }
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const dx = e.key === 'ArrowLeft' ? -STEP : e.key === 'ArrowRight' ? STEP : 0;
    const dy = e.key === 'ArrowUp' ? -STEP : e.key === 'ArrowDown' ? STEP : 0;
    if (!dx && !dy) return;
    e.preventDefault();
    setRect((r) => {
      if (!e.shiftKey) return clampCrop({ ...r, x: r.x + dx, y: r.y + dy });
      let w = r.w + dx;
      let h = r.h + dy;
      if (lock) {
        if (dx) h = w / normAspect;
        else w = h * normAspect;
      }
      if (w < MIN_CROP || h < MIN_CROP || r.x + w > 1 || r.y + h > 1) return r;
      return clampCrop({ ...r, w, h });
    });
  };

  const pct = (v: number) => `${(v * 100).toFixed(3)}%`;

  return (
    <dialog
      ref={dialog}
      class="crop-dialog"
      aria-labelledby="crop-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <h2 id="crop-title">{t('crop.title')}</h2>
      <p class="hint" id="crop-help">
        {t('crop.help')}
      </p>
      <label class="toggle">
        <input type="checkbox" checked={lock} onChange={(e) => toggleLock(e.currentTarget.checked)} />
        <span>{t('crop.lock')}</span>
      </label>
      <div class="crop-area" ref={area} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} style={{ aspectRatio: `${space.width} / ${space.height}` }}>
        {frame ? <canvas ref={canvas} /> : <span class="busy">{t('preview.rendering')}</span>}
        <div
          class="crop-rect"
          role="group"
          tabIndex={0}
          aria-label={t('crop.region')}
          aria-describedby="crop-help"
          data-testid="crop-rect"
          style={{ left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h) }}
          onPointerDown={onPointerDown('move')}
          onKeyDown={onKeyDown}
        >
          {(['nw', 'ne', 'sw', 'se'] as const).map((c) => (
            <span key={c} class={`handle handle-${c}`} role="presentation" title={t('crop.handle', { corner: t(`crop.corner.${c}`) })} onPointerDown={onPointerDown(c)} />
          ))}
        </div>
      </div>
      <div class="dialog-actions">
        <button
          type="button"
          class="button ghost"
          onClick={() => {
            onApply(null);
          }}
        >
          {t('crop.clear')}
        </button>
        <span class="spacer" />
        <button type="button" class="button" onClick={onClose}>
          {t('crop.cancel')}
        </button>
        <button type="button" class="button primary" data-testid="crop-apply" onClick={() => onApply(rect)}>
          {t('crop.apply')}
        </button>
      </div>
    </dialog>
  );
}
