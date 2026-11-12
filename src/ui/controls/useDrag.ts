import { useRef } from "react";

/**
 * Pointer-capture drag within an element. Reports normalized 0..1 coordinates
 * (top-left origin). Continues tracking even if the pointer leaves the element.
 */
export function useDrag(onMove: (nx: number, ny: number) => void) {
  const ref = useRef<HTMLDivElement>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    const handle = (cx: number, cy: number) =>
      onMove((cx - rect.left) / rect.width, (cy - rect.top) / rect.height);
    handle(e.clientX, e.clientY);

    const move = (ev: PointerEvent) => handle(ev.clientX, ev.clientY);
    const up = (ev: PointerEvent) => {
      try {
        el.releasePointerCapture(ev.pointerId);
      } catch {
        /* pointer already released */
      }
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };

  return { ref, onPointerDown };
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
