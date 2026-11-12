// Single source of truth for every control. Drives both the UI and the
// WebGL renderer (which reads the live config each frame).

export type InputMode = "glow" | "upload";
export type GridType = "square" | "hex" | "brick";
export type GlowShape = "radial" | "arc" | "linear" | "corner";

/** Fine structure mixed into the glow. Without it a lens has nothing to bend. */
export type GlowPattern = "none" | "grain" | "rings" | "weave";

/** Direction the field/tiles dissolve toward the falloff background color. */
export type FalloffDir =
  | "none"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "tl"
  | "tr"
  | "bl"
  | "br";

export interface GlowConfig {
  shape: GlowShape;
  /** 1-3 hex colors, composited along the shape. */
  colors: string[];
  /** Background color the glow sits on. */
  bg: string;
  /** Glow center, normalized 0..1 (origin top-left). */
  pos: [number, number];
  /** Glow size / spread, 0..1. */
  spread: number;
  /** Direction for linear / arc / corner shapes, degrees. */
  angle: number;
  /** Structure the glass refracts. Rides the sharp source, not the blurred bed. */
  pattern: GlowPattern;
  patternAmount: number; // 0..1
  patternScale: number; // 0..1
}

export interface FalloffConfig {
  dir: FalloffDir;
  /** Edge softness of the dissolve, 0..1. */
  softness: number;
  /** How far the fade eats into the frame, 0..1. */
  amount: number;
  /** Color it dissolves into (e.g. white). */
  bg: string;
}

export interface Config {
  mode: InputMode;

  glow: GlowConfig;

  // ---- Source prep (applied to the field before tiles see it) ----
  sourceBlur: number; // 0..200 (px at 1x)
  brightness: number; // -1..1, 0 = neutral
  contrast: number; // -1..1, 0 = neutral

  // ---- Tiles ----
  tileSize: number; // px at 1x
  grid: GridType;
  grout: number; // px gap between tiles
  rounding: number; // 0..1 fraction of half-tile -> corner radius
  jitter: number; // 0..1 per-tile size jitter
  /** Snap the grid to whole tiles so the frame does not end mid-tile. */
  fitGrid: boolean;
  groutShade: number; // 0..1 how far the grout drops below the backdrop

  // ---- Glass / surface ----
  // These map onto a real material: the tile is a beveled slab with an index
  // of refraction, a microfacet roughness, and an absorption coefficient.
  transmission: number; // 0..1 sharp backdrop vs. flat blurred bed
  refraction: number; // 0..1 optical DEPTH -- how far light walks through it
  relief: number; // 0..1 surface curvature, independent of depth
  ior: number; // 1..2.2 index of refraction (Fresnel F0 + bend)
  bevel: number; // 0..1 bevel width as a fraction of the half-tile
  roughness: number; // 0.02..1 GGX lobe width + environment blur
  frost: number; // 0..1 transmission blur radius -> mip LOD
  sheen: number; // 0..1 specular highlight intensity
  edgeHighlight: number; // 0..1 Fresnel * environment reflection strength
  dispersion: number; // 0..1 per-channel IOR spread (Cauchy)
  tint: string; // Beer-Lambert absorption color
  tintOpacity: number; // 0..1 absorption density
  grain: number; // 0..1 static micro-roughness on the surface normal

  // ---- Light ----
  /** Direction on the unit disc; magnitude is elevation (0 = head-on). */
  lightDir: [number, number];
  bendToCursor: boolean;
  bendStrength: number; // 0..1

  // ---- Falloff ----
  falloff: FalloffConfig;
}

export type PresetName = "Platinum" | "Aurora" | "Frosted" | "Crystal";

/**
 * Artboard / export size. The artboard is sized to this, so the preview frame
 * is literally the frame you export. Real pixel dimensions rather than bare
 * ratios, because brand assets are commissioned at specific sizes.
 */
export type SizeKey =
  | "square"
  | "portrait45"
  | "story"
  | "wide"
  | "og"
  | "desktop"
  | "banner";

export interface ExportSize {
  label: string;
  w: number;
  h: number;
}

export const EXPORT_SIZES: Record<SizeKey, ExportSize> = {
  square: { label: "Square post - 1080 x 1080", w: 1080, h: 1080 },
  portrait45: { label: "Portrait post - 1080 x 1350", w: 1080, h: 1350 },
  story: { label: "Story - 1080 x 1920", w: 1080, h: 1920 },
  wide: { label: "Widescreen - 1920 x 1080", w: 1920, h: 1080 },
  og: { label: "Open Graph - 1200 x 630", w: 1200, h: 630 },
  desktop: { label: "Desktop - 2560 x 1440", w: 2560, h: 1440 },
  banner: { label: "Wide banner - 1584 x 396", w: 1584, h: 396 },
};

export const SIZE_ORDER: SizeKey[] = [
  "square",
  "portrait45",
  "story",
  "wide",
  "og",
  "desktop",
  "banner",
];
