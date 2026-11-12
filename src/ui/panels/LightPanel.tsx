import { useStore } from "../../state/store";
import { Slider } from "../controls/Slider";
import { Toggle } from "../controls/Toggle";
import { LightSphere } from "../controls/LightSphere";

export function LightPanel() {
  const cfg = useStore((s) => s.config);
  const update = useStore((s) => s.update);
  return (
    <>
      <LightSphere
        label="Light direction"
        value={cfg.lightDir}
        onChange={(v) => update({ lightDir: v })}
      />
      <Toggle
        label="Bend toward cursor"
        checked={cfg.bendToCursor}
        onChange={(v) => update({ bendToCursor: v })}
      />
      {cfg.bendToCursor && (
        <Slider
          label="Bend strength"
          value={cfg.bendStrength}
          min={0}
          max={1}
          step={0.01}
          decimals={2}
          onChange={(v) => update({ bendStrength: v })}
        />
      )}
    </>
  );
}
