import { useEffect, useState } from "react";
import { useStore } from "../state/store";
import { deriveAccent, pickDominant, dominantColorFromBitmap } from "./colorAccent";

/**
 * Drives the UI accent (slider fills, switches, presets, buttons, focus ring)
 * from the current source: the most vivid glow stop, or an uploaded image's
 * dominant color. Updates live as colors change or a new image is loaded.
 */
export function useAdaptiveAccent() {
  const mode = useStore((s) => s.config.mode);
  const colors = useStore((s) => s.config.glow.colors);
  const image = useStore((s) => s.image);
  const [imageColor, setImageColor] = useState<string | null>(null);

  // Dominant color is computed once per image (it's a small canvas readback).
  useEffect(() => {
    if (!image) {
      setImageColor(null);
      return;
    }
    try {
      setImageColor(dominantColorFromBitmap(image));
    } catch {
      setImageColor(null);
    }
  }, [image]);

  useEffect(() => {
    const source = mode === "upload" && imageColor ? imageColor : pickDominant(colors);
    const a = deriveAccent(source);
    const root = document.documentElement.style;
    root.setProperty("--accent", a.accent);
    root.setProperty("--accent-strong", a.strong);
    root.setProperty("--focus-ring", a.ring);
    // These two used to be fixed while the rest of the accent moved, so the
    // preset glow and button text visibly desynced from the artwork.
    root.setProperty("--accent-contrast", a.contrast);
    root.setProperty("--accent-soft", a.soft);
  }, [mode, colors, imageColor]);
}
