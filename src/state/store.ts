import { create } from "zustand";
import type { Config, GlowConfig, FalloffConfig, PresetName, SizeKey } from "./types";
import { DEFAULT_CONFIG, PRESETS, cloneConfig } from "./presets";
import { loadLooks, persistLooks, MAX_LOOKS, type SavedLook } from "./looks";

/**
 * Renderer reads config via `useStore.getState().config` inside its rAF loop,
 * so slider drags never re-render the canvas through React. The source/blur
 * passes are expensive, so we only rebuild them when `sourceRev` changes.
 */
interface StoreState {
  config: Config;
  /** The last applied preset. Per-section reset restores from this. */
  baseline: Config;
  image: ImageBitmap | null;
  imageName: string | null;
  /** Bumps whenever a field that feeds the source/blur passes changes. */
  sourceRev: number;
  presetName: PresetName | "Custom";
  /** Artboard shape. Not part of Config, so presets never clobber it. */
  sizeKey: SizeKey;

  update: (patch: Partial<Config>) => void;
  updateGlow: (patch: Partial<GlowConfig>) => void;
  updateFalloff: (patch: Partial<FalloffConfig>) => void;
  setImage: (image: ImageBitmap | null, name?: string | null) => void;
  applyPreset: (name: PresetName) => void;
  setSize: (sizeKey: SizeKey) => void;
  /** User-saved looks, newest first. */
  looks: SavedLook[];
  saveLook: (name: string, thumb: string) => void;
  deleteLook: (name: string) => void;
  applyLook: (name: string) => void;
  /** Apply settings loaded from the backend (missing keys keep their defaults). */
  applySettings: (saved: Partial<Config>) => void;
  /** Restore just these keys from the baseline preset. */
  resetKeys: (keys: (keyof Config)[]) => void;
  resetAll: () => void;
}

/** Top-level fields that, when changed, require rebuilding the source field. */
const SOURCE_KEYS = new Set<keyof Config>([
  "mode",
  "sourceBlur",
  "brightness",
  "contrast",
  "glow",
]);

function touchesSource(patch: Partial<Config>): boolean {
  return Object.keys(patch).some((k) => SOURCE_KEYS.has(k as keyof Config));
}

export const useStore = create<StoreState>((set) => ({
  config: cloneConfig(DEFAULT_CONFIG),
  baseline: cloneConfig(DEFAULT_CONFIG),
  image: null,
  imageName: null,
  sourceRev: 0,
  presetName: "Platinum",
  sizeKey: "square",

  update: (patch) =>
    set((s) => ({
      config: { ...s.config, ...patch },
      presetName: "Custom",
      sourceRev: touchesSource(patch) ? s.sourceRev + 1 : s.sourceRev,
    })),

  // Glow always feeds the source pass.
  updateGlow: (patch) =>
    set((s) => ({
      config: { ...s.config, glow: { ...s.config.glow, ...patch } },
      presetName: "Custom",
      sourceRev: s.sourceRev + 1,
    })),

  // Falloff lives in the tile pass — no source rebuild needed.
  updateFalloff: (patch) =>
    set((s) => ({
      config: { ...s.config, falloff: { ...s.config.falloff, ...patch } },
      presetName: "Custom",
    })),

  setImage: (image, name = null) =>
    set((s) => ({
      image,
      imageName: name,
      config: { ...s.config, mode: image ? "upload" : "glow" },
      sourceRev: s.sourceRev + 1,
    })),

  applyPreset: (name) =>
    set((s) => ({
      config: cloneConfig(PRESETS[name]),
      baseline: cloneConfig(PRESETS[name]),
      presetName: name,
      sourceRev: s.sourceRev + 1,
    })),

  setSize: (sizeKey) => set({ sizeKey }),

  looks: loadLooks(),

  saveLook: (name, thumb) =>
    set((s) => {
      const entry: SavedLook = { name, thumb, config: cloneConfig(s.config) };
      // Saving under an existing name overwrites it rather than duplicating.
      const rest = s.looks.filter((l) => l.name !== name);
      const looks = [entry, ...rest].slice(0, MAX_LOOKS);
      persistLooks(looks);
      return { looks, presetName: "Custom", baseline: cloneConfig(s.config) };
    }),

  deleteLook: (name) =>
    set((s) => {
      const looks = s.looks.filter((l) => l.name !== name);
      persistLooks(looks);
      return { looks };
    }),

  applyLook: (name) =>
    set((s) => {
      const look = s.looks.find((l) => l.name === name);
      if (!look) return {};
      return {
        config: cloneConfig(look.config),
        baseline: cloneConfig(look.config),
        presetName: "Custom",
        sourceRev: s.sourceRev + 1,
      };
    }),

  applySettings: (saved) =>
    set((s) => {
      const base = cloneConfig(DEFAULT_CONFIG);
      const config: Config = cloneConfig({
        ...base,
        ...saved,
        glow: { ...base.glow, ...saved.glow },
        falloff: { ...base.falloff, ...saved.falloff },
        // An uploaded image isn't saved, so come back to the glow source.
        mode: s.image ? s.config.mode : "glow",
      });
      return {
        config,
        baseline: cloneConfig(config),
        presetName: "Custom",
        sourceRev: s.sourceRev + 1,
      };
    }),

  resetKeys: (keys) =>
    set((s) => {
      const patch: Partial<Config> = {};
      const base = cloneConfig(s.baseline);
      for (const k of keys) {
        // Assigning through a widened record keeps this one cast instead of
        // one per key; every key is a real keyof Config.
        (patch as Record<string, unknown>)[k] = base[k];
      }
      return {
        config: { ...s.config, ...patch },
        sourceRev: touchesSource(patch) ? s.sourceRev + 1 : s.sourceRev,
      };
    }),

  resetAll: () =>
    set((s) => ({
      config: cloneConfig(s.baseline),
      sourceRev: s.sourceRev + 1,
    })),
}));

/** Imperative snapshot for the render loop. */
export const getConfig = () => useStore.getState().config;
