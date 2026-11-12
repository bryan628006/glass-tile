import { PresetBar } from "./PresetBar";
import { Card } from "./controls/Card";
import { SourcePanel } from "./panels/SourcePanel";
import { TilesPanel } from "./panels/TilesPanel";
import { GlassPanel } from "./panels/GlassPanel";
import { SurfacePanel } from "./panels/SurfacePanel";
import { LightPanel } from "./panels/LightPanel";
import { FalloffPanel } from "./panels/FalloffPanel";
import { ExportPanel } from "./panels/ExportPanel";

/** Contents of the right rail: one card per section. */
export function ControlPanel() {
  return (
    <>
      <Card title="Presets">
        <PresetBar />
      </Card>

      <Card
        title="Source"
        resets={["mode", "glow", "sourceBlur", "brightness", "contrast"]}
      >
        <SourcePanel />
      </Card>

      <Card
        title="Tiles"
        resets={["tileSize", "grid", "grout", "rounding", "jitter", "groutShade", "fitGrid"]}
      >
        <TilesPanel />
      </Card>

      <Card title="Glass" resets={["transmission", "refraction", "relief", "ior", "bevel"]}>
        <GlassPanel />
      </Card>

      <Card
        title="Surface"
        defaultOpen={false}
        resets={[
          "roughness",
          "frost",
          "sheen",
          "edgeHighlight",
          "dispersion",
          "tint",
          "tintOpacity",
          "grain",
        ]}
      >
        <SurfacePanel />
      </Card>

      <Card title="Light" resets={["lightDir", "bendToCursor", "bendStrength"]}>
        <LightPanel />
      </Card>

      <Card title="Falloff" resets={["falloff"]}>
        <FalloffPanel />
      </Card>

      <Card title="Export" defaultOpen={false}>
        <ExportPanel />
      </Card>
    </>
  );
}
