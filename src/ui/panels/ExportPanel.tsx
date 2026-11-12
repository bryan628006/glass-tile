import { useRef, useState } from "react";
import { getRenderer } from "../../engine/instance";
import { exportPNG, copyPNG } from "../../export/png";
import { exportGIF } from "../../export/gif";
import { exportVideo, pickVideoMime } from "../../export/webm";
import { exportFigmaSVG } from "../../export/figmaSvg";
import type { PathShape } from "../../export/cursorPath";
import { Slider } from "../controls/Slider";
import { Toggle } from "../controls/Toggle";
import { Segmented } from "../controls/Segmented";
import { Select } from "../controls/Select";
import { useStore } from "../../state/store";
import { EXPORT_SIZES, SIZE_ORDER, type SizeKey } from "../../state/types";

// The artboard IS the export frame, so the ratio lives in the store and this
// panel reads it rather than keeping a second, divergent copy.

/** Cap a video's long edge (encoder safety) and force even dimensions (H.264). */
const MAX_VIDEO_EDGE = 2560;
function videoSize(w: number, h: number): [number, number] {
  let vw = w;
  let vh = h;
  const m = Math.max(vw, vh);
  if (m > MAX_VIDEO_EDGE) {
    const k = MAX_VIDEO_EDGE / m;
    vw = Math.round(vw * k);
    vh = Math.round(vh * k);
  }
  vw -= vw % 2;
  vh -= vh % 2;
  return [Math.max(2, vw), Math.max(2, vh)];
}

const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, "0")}`;
};

export function ExportPanel() {
  const sizeKey = useStore((s) => s.sizeKey);
  const setSize = useStore((s) => s.setSize);
  const presetName = useStore((s) => s.presetName);
  const [scale, setScale] = useState<"1" | "2" | "4">("2");
  const [transparent, setTransparent] = useState(false);
  const [fps, setFps] = useState(30);
  const [duration, setDuration] = useState(4);
  const [shape, setShape] = useState<PathShape>("ellipse");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);

  const videoLabel = pickVideoMime().ext.toUpperCase();
  const { w: bw, h: bh } = EXPORT_SIZES[sizeKey];
  const s = parseInt(scale, 10);
  const pngW = bw * s;
  const pngH = bh * s;
  const [vw, vh] = videoSize(pngW, pngH); // video honors the resolution scale too

  // A meaningful filename: brand asset libraries are not helped by a timestamp.
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const fileName = `glass-tile-${slug(presetName)}-${pngW}x${pngH}.png`;

  const eta = busy && progress > 0.03 ? (elapsed * (1 - progress)) / progress : null;

  async function run(kind: "png" | "copy" | "svg" | "gif" | "webm") {
    const r = getRenderer();
    if (!r || busy) return;
    setBusy(true);
    setProgress(0);
    setElapsed(0);
    startRef.current = performance.now();
    const timer = window.setInterval(
      () => setElapsed((performance.now() - startRef.current) / 1000),
      200
    );
    setStatus(
      kind === "png" || kind === "copy"
        ? "Rendering…"
        : kind === "svg"
          ? "Building SVG…"
          : "Rendering frames…"
    );
    let savedMsg = "Saved ✓";
    try {
      if (kind === "png") {
        await exportPNG(r, pngW, pngH, transparent, fileName);
      } else if (kind === "copy") {
        await copyPNG(r, pngW, pngH, transparent);
        savedMsg = "Copied to clipboard ✓";
      } else if (kind === "svg") {
        const res = exportFigmaSVG(r, pngW, pngH);
        savedMsg = res.editable ? `Saved ✓ · ${res.tiles} editable tiles` : "Saved ✓ · flat image";
      } else if (kind === "gif") {
        // GIFs stay small regardless of scale (palette + size constraints).
        const gifScale = Math.min(1, 600 / Math.max(bw, bh));
        await exportGIF(
          r,
          {
            width: Math.round(bw * gifScale),
            height: Math.round(bh * gifScale),
            frames: Math.max(2, Math.round(fps * duration)),
            fps,
            loopSeconds: duration,
            shape,
          },
          (p) => {
            setProgress(p);
            setStatus(p < 0.5 ? "Rendering frames…" : "Encoding GIF…");
          }
        );
      } else {
        await exportVideo(
          r,
          { width: vw, height: vh, fps, loopSeconds: duration, shape },
          (p) => {
            setProgress(p);
            setStatus("Recording…");
          }
        );
      }
      setStatus(savedMsg);
    } catch (err) {
      setStatus("Export failed");
      console.error(err);
    } finally {
      clearInterval(timer);
      setProgress(0);
      setBusy(false);
      setTimeout(() => setStatus(""), 2600);
    }
  }

  return (
    <>
      <Select<SizeKey>
        label="Size"
        value={sizeKey}
        onChange={setSize}
        options={SIZE_ORDER.map((k) => ({ value: k, label: EXPORT_SIZES[k].label }))}
      />
      <Segmented<"1" | "2" | "4">
        label="Resolution"
        value={scale}
        onChange={setScale}
        options={[
          { value: "1", label: "1×" },
          { value: "2", label: "2×" },
          { value: "4", label: "4×" },
        ]}
      />
      <div className="export-dim tabular">
        {pngW} × {pngH} · PNG
      </div>
      <Toggle label="Transparent PNG" checked={transparent} onChange={setTransparent} />
      <button type="button" className="btn-primary" disabled={busy} onClick={() => run("png")}>
        Download PNG
      </button>
      <div className="export-buttons">
        <button type="button" className="btn-quiet" disabled={busy} onClick={() => run("copy")}>
          Copy image
        </button>
        <button type="button" className="btn-quiet" disabled={busy} onClick={() => run("svg")}>
          Figma SVG
        </button>
      </div>
      <div className="export-hint">
        Imports as editable tile layers. Heavy refraction/frost/hex export as a flat image.
      </div>

      <div className="export-sep">Animated loop</div>
      <Segmented<PathShape>
        label="Motion"
        value={shape}
        onChange={setShape}
        options={[
          { value: "ellipse", label: "Orbit" },
          { value: "figure8", label: "Figure 8" },
          { value: "drift", label: "Drift" },
        ]}
      />
      <Slider label="FPS" value={fps} min={12} max={60} step={1} onChange={setFps} />
      <Slider
        label="Duration"
        value={duration}
        min={1}
        max={8}
        step={0.5}
        decimals={1}
        unit="s"
        onChange={setDuration}
      />
      <div className="export-dim tabular">
        {vw} × {vh} · {videoLabel} (GIF capped to 600px)
      </div>
      <div className="export-buttons">
        <button type="button" className="btn-primary" disabled={busy} onClick={() => run("gif")}>
          GIF
        </button>
        <button type="button" className="btn-primary" disabled={busy} onClick={() => run("webm")}>
          {videoLabel}
        </button>
      </div>

      {(busy || status) && (
        <div className="export-status" role="status" aria-live="polite">
          <div className="export-bar">
            <div className="export-bar-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <span className="export-status-text tabular">
            {status}
            {busy && ` · ${Math.round(progress * 100)}%`}
            {busy && ` · ${fmtTime(elapsed)}`}
            {eta != null && ` · ~${fmtTime(eta)} left`}
          </span>
        </div>
      )}
    </>
  );
}
