import { useEffect, useRef, useState } from "react";
import { Artboard } from "./ui/Artboard";
import { ControlPanel } from "./ui/ControlPanel";
import { TopBar } from "./ui/TopBar";
import { Footer } from "./ui/Footer";
import { useStore } from "./state/store";
import { PRESET_ORDER } from "./state/presets";
import { useAdaptiveAccent } from "./ui/useAdaptiveAccent";

export default function App() {
  const [panelOpen, setPanelOpen] = useState(false); // mobile sheet
  const railRef = useRef<HTMLElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);

  // UI accent follows the gradient's main color / the uploaded image.
  useAdaptiveAccent();

  // Keyboard shortcuts: 1–4 apply presets (skipped while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      )
        return;
      if (e.key === "Escape" && panelOpen) {
        setPanelOpen(false);
        fabRef.current?.focus();
        return;
      }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= PRESET_ORDER.length) {
        useStore.getState().applyPreset(PRESET_ORDER[n - 1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen]);

  // Move focus into the sheet when it opens, so the drawer is usable by
  // keyboard at all. Off-screen it is inert (below), not merely translated.
  useEffect(() => {
    if (panelOpen) railRef.current?.querySelector<HTMLElement>("button")?.focus();
  }, [panelOpen]);

  return (
    <div className="app" data-panel-open={panelOpen}>
      <TopBar />
      <Artboard />

      <button
        type="button"
        className="panel-scrim"
        aria-label="Close controls"
        tabIndex={panelOpen ? 0 : -1}
        onClick={() => setPanelOpen(false)}
      />

      <aside className="rail scroll" aria-label="Controls" ref={railRef}>
        <div className="panel-handle" aria-hidden />
        <ControlPanel />
      </aside>

      <Footer />

      <button
        type="button"
        className="panel-fab"
        ref={fabRef}
        aria-expanded={panelOpen}
        onClick={() => setPanelOpen((o) => !o)}
      >
        {panelOpen ? "Close" : "Controls"}
      </button>
    </div>
  );
}
