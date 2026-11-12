interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  /** Decimal places for the live readout. */
  decimals?: number;
  onChange: (v: number) => void;
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  decimals = 0,
  onChange,
}: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="ctl ctl-slider">
      <div className="ctl-row">
        <span className="ctl-label">{label}</span>
        <span className="ctl-value tabular">
          {value.toFixed(decimals)}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ ["--pct" as string]: `${pct}%` }}
        aria-label={label}
      />
    </label>
  );
}
