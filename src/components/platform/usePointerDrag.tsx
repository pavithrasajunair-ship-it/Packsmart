import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface DragState {
  id: string;
  label: string;
  x: number;
  y: number;
  /** The data-dropzone value under the pointer, or null. */
  overZone: string | null;
}

function zoneAt(x: number, y: number): string | null {
  if (typeof document === 'undefined') return null;
  for (const el of document.elementsFromPoint(x, y)) {
    const zone = (el as HTMLElement).closest?.('[data-dropzone]');
    if (zone) return zone.getAttribute('data-dropzone');
  }
  return null;
}

/**
 * A small pointer-events drag and drop. Mouse and pen can start a drag from anywhere
 * on the element; touch only from an element marked data-grip, so the page still scrolls.
 * Drop targets are any element with a data-dropzone="name" attribute.
 */
export function usePointerDrag(onDrop: (id: string, zone: string) => void) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;
  const stopRef = useRef<(() => void) | null>(null);
  const justDragged = useRef(false);

  useEffect(() => () => stopRef.current?.(), []);

  const begin = useCallback(
    (id: string, label: string) => (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (e.pointerType === 'touch' && !target.closest('[data-grip]')) return;
      // Let real controls inside the element (buttons, inputs) keep their own behaviour.
      if (target.closest('[data-nodrag]')) return;
      stopRef.current?.();

      const sx = e.clientX;
      const sy = e.clientY;
      let active = false;
      const prevSelect = document.body.style.userSelect;

      const onMove = (ev: PointerEvent) => {
        if (!active) {
          if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
          active = true;
          document.body.style.userSelect = 'none';
        }
        if (ev.cancelable) ev.preventDefault();
        setDrag({ id, label, x: ev.clientX, y: ev.clientY, overZone: zoneAt(ev.clientX, ev.clientY) });
      };
      const finish = (ev: PointerEvent, commit: boolean) => {
        stop();
        if (!active) return;
        const zone = commit ? zoneAt(ev.clientX, ev.clientY) : null;
        setDrag(null);
        justDragged.current = true;
        window.setTimeout(() => {
          justDragged.current = false;
        }, 80);
        if (zone) onDropRef.current(id, zone);
      };
      const onUp = (ev: PointerEvent) => finish(ev, true);
      const onCancel = (ev: PointerEvent) => finish(ev, false);
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key === 'Escape') {
          stop();
          setDrag(null);
        }
      };
      const stop = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        window.removeEventListener('keydown', onKey);
        document.body.style.userSelect = prevSelect;
        stopRef.current = null;
      };
      stopRef.current = stop;
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      window.addEventListener('keydown', onKey);
    },
    []
  );

  /** True right after a drag ends, so the click that follows it can be ignored. */
  const wasDragged = useCallback(() => justDragged.current, []);

  return { drag, begin, wasDragged };
}

/** The label that follows the pointer while dragging. */
export const DragGhost: React.FC<{ drag: DragState | null }> = ({ drag }) => {
  if (!drag || typeof document === 'undefined') return null;
  return createPortal(
    <div
      aria-hidden="true"
      className="fixed left-0 top-0 z-[100] pointer-events-none rounded-full bg-[#0B3B40] text-[#FBFAF8] text-xs font-semibold px-3.5 py-2 shadow-[0_18px_40px_-12px_rgba(10,10,10,0.55)] border border-[#FBFAF8]/25 max-w-[220px] truncate"
      style={{ transform: `translate3d(${drag.x + 14}px, ${drag.y + 14}px, 0)` }}
    >
      {drag.label}
    </div>,
    document.body
  );
};
