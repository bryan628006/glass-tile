interface Option<T extends string> {
  value: T;
  label: string;
}

interface SelectProps<T extends string> {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
}

/** A native select, styled. Long option lists outgrow a segmented control. */
export function Select<T extends string>({ label, value, options, onChange }: SelectProps<T>) {
  return (
    <label className="ctl ctl-select">
      <span className="ctl-label">{label}</span>
      <span className="select-wrap">
        <select value={value} onChange={(e) => onChange(e.target.value as T)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg className="select-chevron" width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path
            d="M2 3.5 L5 6.5 L8 3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </label>
  );
}
