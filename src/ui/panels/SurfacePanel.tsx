import { useStore } from "../../state/store";
import { Slider } from "../controls/Slider";
import { ColorField } from "../controls/ColorField";

/** The finish on the pane: how it scatters, reflects, and absorbs. */
export function SurfacePanel() {
  const cfg = useStore((s) => s.config);
  const update = useStore((s) => s.update);
  // Dispersion needs a bevel to fringe against, and some depth to bend through.
  const showDispersion = cfg.refraction > 0.05 || cfg.dispersion > 0;

  return (
    <>
      <Slider
        label="Roughness"
        value={cfg.roughness}
        min={0.02}
        max={1}
        step={0.01}
        decimals={2}
        onChange={(v) => update({ roughness: v })}
      />
      <Slider
        label="Frost"
        value={cfg.frost}
        min={0}
        max={1}
        step={0.01}
        decimals={2}
        onChange={(v) => update({ frost: v })}
      />
      <Slider
        label="Specular"
        value={cfg.sheen}
        min={0}
        max={1}
        step={0.01}
        decimals={2}
        onChange={(v) => update({ sheen: v })}
      />
      <Slider
        label="Reflection"
        value={cfg.edgeHighlight}
        min={0}
        max={1}
        step={0.01}
        decimals={2}
        onChange={(v) => update({ edgeHighlight: v })}
      />
      {showDispersion && (
        <Slider
          label="Dispersion"
          value={cfg.dispersion}
          min={0}
          max={1}
          step={0.01}
          decimals={2}
          onChange={(v) => update({ dispersion: v })}
        />
      )}
      <ColorField label="Tint" value={cfg.tint} onChange={(v) => update({ tint: v })} />
      <Slider
        label="Tint density"
        value={cfg.tintOpacity}
        min={0}
        max={1}
        step={0.01}
        decimals={2}
        onChange={(v) => update({ tintOpacity: v })}
      />
      <Slider
        label="Surface grain"
        value={cfg.grain}
        min={0}
        max={1}
        step={0.01}
        decimals={2}
        onChange={(v) => update({ grain: v })}
      />
    </>
  );
}
