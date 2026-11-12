import { useStore } from "../../state/store";
import { Slider } from "../controls/Slider";

/**
 * The optics of the pane: how much of the world you see through it, how deep
 * the slab is, how hard it bends light, and how wide the bevel runs.
 */
export function GlassPanel() {
  const cfg = useStore((s) => s.config);
  const update = useStore((s) => s.update);

  return (
    <>
      <Slider
        label="Transmission"
        value={cfg.transmission}
        min={0}
        max={1}
        step={0.01}
        decimals={2}
        onChange={(v) => update({ transmission: v })}
      />
      <Slider
        label="Depth"
        value={cfg.refraction}
        min={0}
        max={1}
        step={0.01}
        decimals={2}
        onChange={(v) => update({ refraction: v })}
      />
      {/* Separate from Depth: how curved the surface LOOKS, versus how far
          light actually travels through it. */}
      <Slider
        label="Relief"
        value={cfg.relief}
        min={0}
        max={1}
        step={0.01}
        decimals={2}
        onChange={(v) => update({ relief: v })}
      />
      <Slider
        label="Index (IOR)"
        value={cfg.ior}
        min={1}
        max={2.2}
        step={0.01}
        decimals={2}
        onChange={(v) => update({ ior: v })}
      />
      <Slider
        label="Bevel"
        value={cfg.bevel}
        min={0}
        max={1}
        step={0.01}
        decimals={2}
        onChange={(v) => update({ bevel: v })}
      />
    </>
  );
}
