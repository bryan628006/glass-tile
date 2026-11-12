import { useStore } from "../../state/store";
import type { GlowShape, GlowPattern } from "../../state/types";
import { Slider } from "../controls/Slider";
import { Segmented } from "../controls/Segmented";
import { ColorField } from "../controls/ColorField";
import { DragPad } from "../controls/DragPad";
import { UploadDropzone } from "../UploadDropzone";

export function SourcePanel() {
  const cfg = useStore((s) => s.config);
  const update = useStore((s) => s.update);
  const updateGlow = useStore((s) => s.updateGlow);
  const g = cfg.glow;

  const setColor = (i: number, v: string) => {
    const c = [...g.colors];
    c[i] = v;
    updateGlow({ colors: c });
  };
  const addColor = () =>
    updateGlow({ colors: [...g.colors, g.colors[g.colors.length - 1] ?? "#ffffff"] });
  const removeColor = (i: number) =>
    updateGlow({ colors: g.colors.filter((_, j) => j !== i) });

  // Corner honours the angle now too — it used to be a duplicate of radial.
  const showAngle = g.shape !== "radial";

  return (
    <>
      {cfg.mode === "upload" ? (
        <UploadDropzone />
      ) : (
        <>
          <Segmented<GlowShape>
            label="Shape"
            value={g.shape}
            onChange={(v) => updateGlow({ shape: v })}
            options={[
              { value: "radial", label: "Radial" },
              { value: "arc", label: "Arc" },
              { value: "linear", label: "Linear" },
              { value: "corner", label: "Corner" },
            ]}
          />
          {g.colors.map((c, i) => (
            <ColorField
              key={i}
              label={`Color ${i + 1}`}
              value={c}
              onChange={(v) => setColor(i, v)}
              onRemove={g.colors.length > 1 ? () => removeColor(i) : undefined}
            />
          ))}
          {g.colors.length < 3 && (
            <button type="button" className="btn-add" onClick={addColor}>
              + Add color
            </button>
          )}
          <ColorField label="Background" value={g.bg} onChange={(v) => updateGlow({ bg: v })} />
          <DragPad label="Position" value={g.pos} onChange={(v) => updateGlow({ pos: v })} />
          <Slider
            label="Spread"
            value={g.spread}
            min={0.05}
            max={1}
            step={0.01}
            decimals={2}
            onChange={(v) => updateGlow({ spread: v })}
          />
          {showAngle && (
            <Slider
              label="Angle"
              value={g.angle}
              min={0}
              max={360}
              step={1}
              unit="°"
              onChange={(v) => updateGlow({ angle: v })}
            />
          )}

          {/* A gradient has no detail above the tile scale, so glass over one
              has nothing to refract. This is what gives the lens its subject. */}
          <Segmented<GlowPattern>
            label="Structure"
            value={g.pattern}
            onChange={(v) => updateGlow({ pattern: v })}
            options={[
              { value: "none", label: "None" },
              { value: "grain", label: "Grain" },
              { value: "rings", label: "Rings" },
              { value: "weave", label: "Weave" },
            ]}
          />
          {g.pattern !== "none" && (
            <>
              <Slider
                label="Structure amount"
                value={g.patternAmount}
                min={0}
                max={1}
                step={0.01}
                decimals={2}
                onChange={(v) => updateGlow({ patternAmount: v })}
              />
              <Slider
                label="Structure scale"
                value={g.patternScale}
                min={0}
                max={1}
                step={0.01}
                decimals={2}
                onChange={(v) => updateGlow({ patternScale: v })}
              />
            </>
          )}
        </>
      )}

      <Slider
        label="Source blur"
        value={cfg.sourceBlur}
        min={0}
        max={200}
        step={1}
        onChange={(v) => update({ sourceBlur: v })}
      />
      <Slider
        label="Brightness"
        value={cfg.brightness}
        min={-1}
        max={1}
        step={0.01}
        decimals={2}
        onChange={(v) => update({ brightness: v })}
      />
      <Slider
        label="Contrast"
        value={cfg.contrast}
        min={-1}
        max={1}
        step={0.01}
        decimals={2}
        onChange={(v) => update({ contrast: v })}
      />
    </>
  );
}
