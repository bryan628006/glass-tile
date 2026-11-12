import type { Config, PresetName } from "./types";

/** Deep clone so presets are never mutated by reference. */
export function cloneConfig(c: Config): Config {
  return {
    ...c,
    glow: { ...c.glow, colors: [...c.glow.colors], pos: [...c.glow.pos] as [number, number] },
    lightDir: [...c.lightDir] as [number, number],
    falloff: { ...c.falloff },
  };
}

// What makes these read as glass rather than as plastic tiles, in order of
// how much each one mattered:
//
//   1. groutShade near zero. The backdrop has to CONTINUE between the panes.
//      A darkened gap turns the composition into an opaque mosaic no amount of
//      shading can rescue.
//   2. Big panes. A lens has to be large against the detail behind it before
//      its edge squeeze is legible; at 46px over a soft glow there was nothing
//      to see.
//   3. A narrow bezel over a wide flat plateau, so the middle stays optically
//      clear and the bend is packed into the rim.

/**
 * Platinum - the first-load reference look.
 *
 * Deliberately hueless: with no colour competing with the refraction, the
 * material itself reads most clearly, and it is the most neutral place for
 * someone to drop their own brand colours in.
 */
export const PLATINUM: Config = {
  mode: "glow",
  glow: {
    shape: "arc",
    colors: ["#e8ecf4", "#5a6478"],
    bg: "#08090b",
    pos: [0.5, 0.82],
    spread: 0.5,
    angle: 0,
    pattern: "none",
    patternAmount: 0.4,
    patternScale: 0.5,
  },
  sourceBlur: 30,
  brightness: 0.02,
  contrast: 0.06,

  tileSize: 118,
  grid: "square",
  grout: 7,
  rounding: 0.5,
  jitter: 0,
  groutShade: 0.05,
  fitGrid: true,

  transmission: 1,
  refraction: 0.85,
  relief: 0.85,
  ior: 1.5,
  bevel: 0.55,
  roughness: 0.07,
  frost: 0,
  sheen: 0.68,
  edgeHighlight: 0.58,
  dispersion: 0.28,
  tint: "#ffffff",
  tintOpacity: 0,
  grain: 0,

  lightDir: [-0.34, 0.6],
  bendToCursor: false,
  bendStrength: 0.4,

  falloff: { dir: "none", softness: 0.5, amount: 0, bg: "#ffffff" },
};

/** Aurora - thin cut sheet glass dissolving into white from the top. */
export const AURORA: Config = {
  ...cloneConfig(PLATINUM),
  glow: {
    shape: "radial",
    colors: ["#5bf2a8", "#16b98a"],
    bg: "#070a09",
    pos: [0.5, 0.6],
    spread: 0.62,
    angle: 0,
    pattern: "none",
    patternAmount: 0.3,
    patternScale: 0.5,
  },
  sourceBlur: 40,
  tileSize: 96,
  grout: 5,
  rounding: 0.36,
  groutShade: 0.03,
  transmission: 1,
  refraction: 0.55,
  relief: 0.55,
  ior: 1.52,
  bevel: 0.42,
  roughness: 0.05,
  frost: 0,
  sheen: 0.6,
  edgeHighlight: 0.5,
  dispersion: 0.2,
  tint: "#e8fff5",
  tintOpacity: 0.14,
  grain: 0,
  lightDir: [0.44, 0.56],
  falloff: { dir: "top", softness: 0.62, amount: 0.46, bg: "#ffffff" },
};

/** Frosted - sandblasted bricks. The grain gives the scatter something to eat. */
export const FROSTED: Config = {
  ...cloneConfig(PLATINUM),
  glow: {
    shape: "radial",
    colors: ["#7cc6ff", "#9b7dff", "#ff8fd0"],
    bg: "#0a0a10",
    pos: [0.5, 0.5],
    spread: 0.66,
    angle: 0,
    pattern: "grain",
    patternAmount: 0.4,
    patternScale: 0.6,
  },
  sourceBlur: 60,
  tileSize: 130,
  grout: 8,
  rounding: 0.62,
  groutShade: 0.08,
  transmission: 0.95,
  refraction: 0.6,
  relief: 0.6,
  ior: 1.46,
  bevel: 0.65,
  roughness: 0.5,
  frost: 0.5,
  sheen: 0.3,
  edgeHighlight: 0.34,
  dispersion: 0,
  tint: "#eef1ff",
  tintOpacity: 0.16,
  grain: 0.06,
  lightDir: [-0.26, 0.48],
};

/** Crystal - lead crystal. Deep bend, hard prism fringing, fine caustics. */
export const CRYSTAL: Config = {
  ...cloneConfig(PLATINUM),
  glow: {
    shape: "corner",
    colors: ["#ff9d5c", "#ff4d9d", "#7a5cff"],
    bg: "#08070c",
    pos: [0.78, 0.24],
    spread: 0.68,
    angle: 35,
    pattern: "rings",
    patternAmount: 0.28,
    patternScale: 0.8,
  },
  sourceBlur: 18,
  tileSize: 150,
  grout: 6,
  rounding: 0.3,
  groutShade: 0.02,
  transmission: 1,
  refraction: 1,
  relief: 1,
  ior: 1.85,
  bevel: 0.45,
  roughness: 0.04,
  frost: 0,
  sheen: 0.8,
  edgeHighlight: 0.66,
  dispersion: 0.6,
  tint: "#ffffff",
  tintOpacity: 0,
  grain: 0,
  lightDir: [0.56, 0.52],
};

export const PRESETS: Record<PresetName, Config> = {
  Platinum: PLATINUM,
  Aurora: AURORA,
  Frosted: FROSTED,
  Crystal: CRYSTAL,
};

export const PRESET_ORDER: PresetName[] = [
  "Platinum",
  "Aurora",
  "Frosted",
  "Crystal",
];

/** The look shown on first load, before any interaction. */
export const DEFAULT_CONFIG = PLATINUM;
