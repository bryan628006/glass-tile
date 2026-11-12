import type { KeyboardEvent } from "react";
import { useDrag } from "./useDrag";

interface LightSphereProps {
  label: string;
  value: [number, number]; // -1..1, y-up
  onChange: (v: [number, number]) => void;
}

const STEP = 0.05;

/** Clamp to the unit disc — the magnitude is the light's elevation. */
function toDisc(x: number, y: number): [number, number] {
  const len = Math.hypot(x, y);
  return len > 1 ? [x / len, y / len] : [x, y];
}

/** A small sphere with a draggable highlight dot that sets light direction. */
export function LightSphere({ label, value, onChange }: LightSphereProps) {
  const { ref, onPointerDown } = useDrag((nx, ny) =>
    onChange(toDisc(nx * 2 - 1, -(ny * 2 - 1)))
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const d = e.shiftKey ? STEP * 4 : STEP;
    let [x, y] = value;
    if (e.key === "ArrowLeft") x -= d;
    else if (e.key === "ArrowRight") x += d;
    else if (e.key === "ArrowUp") y += d;
    else if (e.key === "ArrowDown") y -= d;
    else return;
    e.preventDefault();
    onChange(toDisc(x, y));
  };

  const dotX = (value[0] * 0.5 + 0.5) * 100;
  const dotY = (0.5 - value[1] * 0.5) * 100;
  const elevation = Math.round((1 - Math.min(1, Math.hypot(value[0], value[1]))) * 100);

  return (
    <div className="ctl ctl-sphere">
      <span className="ctl-label">{label}</span>
      <div
        ref={ref}
        className="sphere"
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="group"
        aria-label={`${label}: ${elevation}% elevation. Use arrow keys to adjust.`}
      >
        <span className="sphere-hi" style={{ left: `${dotX}%`, top: `${dotY}%` }} />
        <span className="sphere-dot" style={{ left: `${dotX}%`, top: `${dotY}%` }} />
      </div>
    </div>
  );
}
