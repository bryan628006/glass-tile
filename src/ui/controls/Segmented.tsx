import { useRef } from "react";

interface Option<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface SegmentedProps<T extends string> {
  label?: string;
  /** Keep the accessible name but drop the visible one (top bar, toolbars). */
  hideLabel?: boolean;
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
}

/**
 * A settings choice, so radiogroup — not the tablist the old markup claimed,
 * which made screen readers announce "tab 1 of 4" for a mode switch.
 * Roving tabindex + arrow keys, per the ARIA radiogroup pattern.
 */
export function Segmented<T extends string>({
  label,
  hideLabel,
  value,
  options,
  onChange,
}: SegmentedProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const active = Math.max(0, options.findIndex((o) => o.value === value));

  const move = (dir: 1 | -1) => {
    const n = options.length;
    for (let i = 1; i <= n; i++) {
      const next = options[(((active + dir * i) % n) + n) % n];
      if (next && !next.disabled) {
        onChange(next.value);
        const btns = ref.current?.querySelectorAll<HTMLButtonElement>(".segment");
        btns?.[options.indexOf(next)]?.focus();
        return;
      }
    }
  };

  return (
    <div className="ctl ctl-segmented">
      {label && !hideLabel && <span className="ctl-label">{label}</span>}
      <div
        ref={ref}
        className="segmented"
        role="radiogroup"
        aria-label={label}
        style={{ ["--count" as string]: options.length, ["--active" as string]: active }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            e.preventDefault();
            move(1);
          } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            e.preventDefault();
            move(-1);
          }
        }}
      >
        {/* Gliding selection indicator (eases to the picked option). */}
        <span className="segment-indicator" aria-hidden />
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            tabIndex={value === o.value ? 0 : -1}
            disabled={o.disabled}
            className="segment"
            data-on={value === o.value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
