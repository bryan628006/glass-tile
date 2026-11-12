import { useEffect, useRef, useState } from "react";
import { Stage } from "./Stage";
import { useStore } from "../state/store";
import { EXPORT_SIZES } from "../state/types";

/** Breathing room between the artboard and the frame edge, for the overlays. */
const GUTTER = 64;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 3;

/**
 * The preview frame: a bounded artboard, sized to the selected export ratio,
 * floating on a transparency checkerboard.
 *
 * The old stage was full-bleed, so there was no way to see the frame you were
 * about to export. Here the artboard IS the export.
 */
export function Artboard() {
  const sizeKey = useStore((s) => s.sizeKey);
  const frameRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setBox({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w: aw, h: ah, label } = EXPORT_SIZES[sizeKey];
  const availW = Math.max(40, box.w - GUTTER);
  const availH = Math.max(40, box.h - GUTTER);
  const fit = Math.min(availW / aw, availH / ah);
  const cssW = Math.max(1, Math.round(aw * fit));
  const cssH = Math.max(1, Math.round(ah * fit));

  // The percentage is honest: displayed size against the exported pixel size,
  // not against "fit". A designer needs to know when they are looking at 1:1.
  const shown = Math.round(fit * zoom * 100);
  const atFit = Math.abs(zoom - 1) < 0.001;

  const step = (dir: 1 | -1) =>
    setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * (dir > 0 ? 1.25 : 1 / 1.25))));

  return (
    <div className="preview">
      <div className="artboard-frame" ref={frameRef}>
        <div className="artboard-ground" aria-hidden />

        {error ? (
          <div className="stage-error" role="alert">
            <h2>WebGL2 required</h2>
            <p>{error}</p>
            <p className="stage-error-sub">
              Try a recent version of Chrome, Edge, Firefox, or Safari.
            </p>
          </div>
        ) : (
          <div
            className="artboard"
            style={{
              width: cssW,
              height: cssH,
              // A display transform, never a change of render resolution:
              // tileSize and grout are in pixels, so re-rendering at a larger
              // size would redesign the artwork instead of magnifying it.
              transform: zoom === 1 ? undefined : `scale(${zoom})`,
            }}
          >
            <Stage onError={setError} />
          </div>
        )}

        <span className="artboard-label eyebrow">Preview</span>

        <div className="artboard-tools">
          <button
            type="button"
            className="icon-btn"
            title="Fit to frame"
            aria-label="Fit to frame"
            disabled={atFit}
            onClick={() => setZoom(1)}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
              <path
                d="M1.5 5V1.5H5M9 1.5h3.5V5M12.5 9v3.5H9M5 12.5H1.5V9"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div className="artboard-meta tabular">
          <span>{shown}%</span>
          <span>
            {aw} × {ah}
          </span>
          <span>{label.split(" - ")[0]}</span>
        </div>

        <div className="artboard-zoom">
          <button
            type="button"
            className="icon-btn"
            aria-label="Zoom out"
            disabled={zoom <= ZOOM_MIN + 0.001}
            onClick={() => step(-1)}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
              <path d="M3 7h8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Zoom in"
            disabled={zoom >= ZOOM_MAX - 0.001}
            onClick={() => step(1)}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
              <path
                d="M7 3v8M3 7h8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
