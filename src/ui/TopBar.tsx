import { useEffect, useState } from "react";
import { getRenderer } from "../engine/instance";
import type { Readout } from "../engine/Renderer";
import { useStore } from "../state/store";
import { Segmented } from "./controls/Segmented";
import { SaveSettingsButton } from "./SaveSettingsButton";
import type { InputMode } from "../state/types";

export function TopBar() {
  const [ro, setRo] = useState<Readout>({ w: 0, h: 0, hex: "" });
  const mode = useStore((s) => s.config.mode);
  const update = useStore((s) => s.update);
  const resetAll = useStore((s) => s.resetAll);
  const presetName = useStore((s) => s.presetName);

  useEffect(() => {
    const id = window.setInterval(() => {
      const r = getRenderer();
      if (r) setRo({ ...r.readout });
    }, 120);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <span className="brand-mark" aria-hidden />
        <span className="topbar-name">Glass Tile</span>
      </div>

      {/* The source mode was buried inside the Source panel; it is the single
          biggest fork in the tool, so it belongs up here. */}
      <Segmented<InputMode>
        label="Source mode"
        hideLabel
        value={mode}
        onChange={(v) => update({ mode: v })}
        options={[
          { value: "glow", label: "Glow" },
          { value: "upload", label: "Image" },
        ]}
      />

      <span className="topbar-spacer" />

      <div className="topbar-readout tabular">
        {ro.w > 0 && (
          <span className="ro-dim">
            {ro.w} × {ro.h}
          </span>
        )}
        {ro.hex && (
          <span className="ro-hex">
            <span className="ro-swatch" style={{ background: ro.hex }} />
            {ro.hex.toUpperCase()}
          </span>
        )}
      </div>

      <div className="topbar-actions">
        <SaveSettingsButton />
        <button
          type="button"
          className="btn-ghost"
          onClick={resetAll}
          disabled={presetName !== "Custom"}
          title="Restore every control to the preset"
        >
          Reset
        </button>
      </div>
    </header>
  );
}
