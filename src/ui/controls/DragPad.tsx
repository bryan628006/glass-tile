import type { KeyboardEvent } from "react";
import { useDrag, clamp01 } from "./useDrag";

interface DragPadProps {
  label: string;
  value: [number, number]; // 0..1, top-left origin
  onChange: (v: [number, number]) => void;
}

/** Arrow-key nudge; Shift for a coarse step. */
const STEP = 0.02;

/** A 2D pad with a draggable dot — used for glow position. */
export function DragPad({ label, value, onChange }: DragPadProps) {
  const { ref, onPointerDown } = useDrag((nx, ny) =>
    onChange([clamp01(nx), clamp01(ny)])
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const d = e.shiftKey ? STEP * 5 : STEP;
    let [x, y] = value;
    if (e.key === "ArrowLeft") x -= d;
    else if (e.key === "ArrowRight") x += d;
    else if (e.key === "ArrowUp") y -= d;
    else if (e.key === "ArrowDown") y += d;
    else return;
    e.preventDefault();
    onChange([clamp01(x), clamp01(y)]);
  };

  return (
    <div className="ctl ctl-pad">
      <span className="ctl-label">{label}</span>
      {/* A two-axis slider, so the group/slider pattern rather than
          role="application" on a div nothing could focus. */}
      <div
        ref={ref}
        className="pad"
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="group"
        aria-label={`${label}: ${Math.round(value[0] * 100)}% across, ${Math.round(
          value[1] * 100
        )}% down. Use arrow keys to adjust.`}
      >
        <span
          className="pad-dot"
          style={{ left: `${value[0] * 100}%`, top: `${value[1] * 100}%` }}
        />
      </div>
    </div>
  );
}
