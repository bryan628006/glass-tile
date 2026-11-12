import { useStore } from "../../state/store";
import type { GridType } from "../../state/types";
import { Slider } from "../controls/Slider";
import { Segmented } from "../controls/Segmented";
import { Toggle } from "../controls/Toggle";

export function TilesPanel() {
  const cfg = useStore((s) => s.config);
  const update = useStore((s) => s.update);
  return (
    <>
      <Slider
        label="Tile size"
        value={cfg.tileSize}
        min={12}
        max={160}
        step={1}
        unit="px"
        onChange={(v) => update({ tileSize: v })}
      />
      <Segmented<GridType>
        label="Grid"
        value={cfg.grid}
        onChange={(v) => update({ grid: v })}
        options={[
          { value: "square", label: "Square" },
          { value: "hex", label: "Hex" },
          { value: "brick", label: "Brick" },
        ]}
      />
      <Slider
        label="Grout"
        value={cfg.grout}
        min={0}
        max={24}
        step={0.5}
        decimals={1}
        unit="px"
        onChange={(v) => update({ grout: v })}
      />
      <Slider
        label="Grout shade"
        value={cfg.groutShade}
        min={0}
        max={1}
        step={0.01}
        decimals={2}
        onChange={(v) => update({ groutShade: v })}
      />
      <Slider
        label="Corner rounding"
        value={cfg.rounding}
        min={0}
        max={1}
        step={0.01}
        decimals={2}
        onChange={(v) => update({ rounding: v })}
      />
      <Slider
        label="Size jitter"
        value={cfg.jitter}
        min={0}
        max={1}
        step={0.01}
        decimals={2}
        onChange={(v) => update({ jitter: v })}
      />
      <Toggle
        label="Fit grid to frame"
        checked={cfg.fitGrid}
        onChange={(v) => update({ fitGrid: v })}
      />
    </>
  );
}
