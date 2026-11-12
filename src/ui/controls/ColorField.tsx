import { useState } from "react";

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onRemove?: () => void;
}

/** #abc / #aabbcc, with or without the hash. */
const HEX = /^([0-9a-f]{3}|[0-9a-f]{6})$/i;

function normalize(raw: string): string | null {
  const h = raw.trim().replace(/^#/, "");
  if (!HEX.test(h)) return null;
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return `#${full.toLowerCase()}`;
}

export function ColorField({ label, value, onChange, onRemove }: ColorFieldProps) {
  // Held locally while typing so a half-finished hex is not pushed to the store
  // on every keystroke.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value.toUpperCase();
  const invalid = draft !== null && normalize(draft) === null;

  const commit = (raw: string) => {
    const hex = normalize(raw);
    if (hex) onChange(hex);
    setDraft(null);
  };

  return (
    <div className="ctl ctl-color">
      <span className="ctl-label">{label}</span>
      <div className="color-right">
        {/* Typeable and pasteable: entering brand colors is the whole job. */}
        <input
          type="text"
          className="color-hex tabular"
          value={shown}
          spellCheck={false}
          autoComplete="off"
          aria-label={`${label} hex value`}
          aria-invalid={invalid || undefined}
          data-invalid={invalid || undefined}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit((e.target as HTMLInputElement).value);
            } else if (e.key === "Escape") {
              setDraft(null);
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        <span className="color-swatch" style={{ background: value }}>
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={`${label} picker`}
          />
        </span>
        {onRemove && (
          <button type="button" className="color-remove" onClick={onRemove} aria-label={`Remove ${label}`}>
            ×
          </button>
        )}
      </div>
    </div>
  );
}
