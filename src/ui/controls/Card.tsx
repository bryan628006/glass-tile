import { useEffect, useId, useState, type ReactNode } from "react";
import { useStore } from "../../state/store";
import type { Config } from "../../state/types";

interface CardProps {
  title: string;
  defaultOpen?: boolean;
  /** Config keys this card owns. Presence of this enables the reset button. */
  resets?: (keyof Config)[];
  children: ReactNode;
}

const STORE_KEY = "glasstile.cards";

function readOpenState(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
  } catch {
    return {}; // private mode / blocked storage: fall back to the defaults
  }
}

/**
 * A collapsible rail section. Expands via grid-template-rows so there is no
 * height jank, and remembers its state across reloads.
 */
export function Card({ title, defaultOpen = true, resets, children }: CardProps) {
  const [open, setOpen] = useState(() => readOpenState()[title] ?? defaultOpen);
  const resetKeys = useStore((s) => s.resetKeys);
  const bodyId = useId();

  useEffect(() => {
    try {
      const all = readOpenState();
      all[title] = open;
      localStorage.setItem(STORE_KEY, JSON.stringify(all));
    } catch {
      // Not persisting a disclosure preference is not worth surfacing.
    }
  }, [title, open]);

  return (
    <section className="card" data-open={open}>
      <div className="card-head">
        <button
          type="button"
          className="card-toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((o) => !o)}
        >
          <svg className="card-chevron" width="10" height="10" viewBox="0 0 10 10" aria-hidden>
            <path
              d="M2 3.5 L5 6.5 L8 3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="card-title eyebrow">{title}</span>
        </button>

        {resets && (
          <button
            type="button"
            className="card-reset"
            title={`Reset ${title} to the preset`}
            aria-label={`Reset ${title} to the preset`}
            onClick={() => resetKeys(resets)}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
              <path
                d="M12 7a5 5 0 1 1-1.6-3.7M12 1.5V4.4H9.1"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>

      {/* inert keeps collapsed content out of the tab order — overflow:hidden
          alone does not remove focusability. */}
      <div className="card-body" id={bodyId} {...(!open && { inert: "" })}>
        <div className="card-body-inner">{children}</div>
      </div>
    </section>
  );
}
