import { useStore } from "../../state/store";
import type { FalloffDir } from "../../state/types";
import { Slider } from "../controls/Slider";
import { ColorField } from "../controls/ColorField";

// 3x3 grid: corners + edges, center = none. `name` is the accessible label —
// "tl" read aloud is not a direction.
const GRID: { dir: FalloffDir; arrow: string; name: string }[] = [
  { dir: "tl", arrow: "↖", name: "Top left" },
  { dir: "top", arrow: "↑", name: "Top" },
  { dir: "tr", arrow: "↗", name: "Top right" },
  { dir: "left", arrow: "←", name: "Left" },
  { dir: "none", arrow: "•", name: "No falloff" },
  { dir: "right", arrow: "→", name: "Right" },
  { dir: "bl", arrow: "↙", name: "Bottom left" },
  { dir: "bottom", arrow: "↓", name: "Bottom" },
  { dir: "br", arrow: "↘", name: "Bottom right" },
];

export function FalloffPanel() {
  const cfg = useStore((s) => s.config);
  const updateFalloff = useStore((s) => s.updateFalloff);
  const f = cfg.falloff;

  return (
    <>
      <div className="ctl ctl-dirgrid">
        <span className="ctl-label">Fade from</span>
        {/* Roving tabindex + arrow keys: nine separately tabbable buttons is
            not the radiogroup pattern, it is nine stops on the way past. */}
        <div
          className="dirgrid"
          role="radiogroup"
          aria-label="Falloff direction"
          onKeyDown={(e) => {
            const i = GRID.findIndex((g) => g.dir === f.dir);
            const d =
              e.key === "ArrowRight" ? 1
              : e.key === "ArrowLeft" ? -1
              : e.key === "ArrowDown" ? 3
              : e.key === "ArrowUp" ? -3
              : 0;
            if (!d) return;
            e.preventDefault();
            const next = GRID[(((i < 0 ? 4 : i) + d) % 9 + 9) % 9];
            updateFalloff({ dir: next.dir });
            e.currentTarget
              .querySelectorAll<HTMLButtonElement>(".dirbtn")
              [GRID.indexOf(next)]?.focus();
          }}
        >
          {GRID.map(({ dir, arrow, name }) => (
            <button
              key={dir}
              type="button"
              role="radio"
              aria-checked={f.dir === dir}
              aria-label={name}
              tabIndex={f.dir === dir ? 0 : -1}
              className="dirbtn"
              data-on={f.dir === dir}
              data-none={dir === "none"}
              onClick={() => updateFalloff({ dir })}
            >
              {arrow}
            </button>
          ))}
        </div>
      </div>
      <Slider
        label="Amount"
        value={f.amount}
        min={0}
        max={1}
        step={0.01}
        decimals={2}
        onChange={(v) => updateFalloff({ amount: v })}
      />
      <Slider
        label="Softness"
        value={f.softness}
        min={0}
        max={1}
        step={0.01}
        decimals={2}
        onChange={(v) => updateFalloff({ softness: v })}
      />
      <ColorField label="Fade to" value={f.bg} onChange={(v) => updateFalloff({ bg: v })} />
    </>
  );
}
