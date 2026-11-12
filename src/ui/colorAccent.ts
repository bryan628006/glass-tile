// Derive a legible UI accent from the current source color (glow stop or the
// dominant color of an uploaded image). Colors are nudged into a bright,
// saturated range so they always read on the dark surface.

export interface Accent {
  accent: string;
  strong: string;
  ring: string;
  /** Black or white, whichever actually reads on `strong`. */
  contrast: string;
  /** Low-alpha accent for hover rings and selected-state glows. */
  soft: string;
}

/** Neutral fallback when the source has essentially no color (grayscale). */
const FALLBACK: Accent = {
  accent: "#a78bfa",
  strong: "#8b5cf6",
  ring: "rgba(167, 139, 250, 0.55)",
  contrast: "#0a0a0c",
  soft: "rgba(167, 139, 250, 0.16)",
};

function hexToRgb255(hex: string): [number, number, number] {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h || "000000", 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Turn any source color into a legible accent pair + focus ring. */
export function deriveAccent(hex: string): Accent {
  const [r, g, b] = hexToRgb255(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  if (s < 0.06) return FALLBACK; // grayscale -> keep the default tint

  const sA = clamp(Math.max(s, 0.55), 0, 1);
  const lA = clamp(l, 0.56, 0.72);
  const accent = hslToHex(h, sA, lA);
  const strong = hslToHex(h, sA, clamp(lA - 0.08, 0.4, 0.7));
  const [sr, sg, sb] = hexToRgb255(strong);
  const [ar, ag, ab] = hexToRgb255(accent);
  return {
    accent,
    strong,
    ring: `rgba(${sr}, ${sg}, ${sb}, 0.55)`,
    // strong lightness floats between 0.40 and 0.70, so neither black nor
    // white is safe to hard-code on top of it.
    contrast: bestContrast(sr, sg, sb),
    soft: `rgba(${ar}, ${ag}, ${ab}, 0.16)`,
  };
}

/** The most vivid glow stop reads as the "main color" of the gradient. */
export function pickDominant(colors: string[]): string {
  let best = colors[0] ?? "#a78bfa";
  let bestScore = -1;
  for (const c of colors) {
    const [r, g, b] = hexToRgb255(c);
    const [, s, l] = rgbToHsl(r, g, b);
    const score = s * (1 - Math.abs(l - 0.55)); // saturated + mid-bright wins
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

/** Saturation-weighted average of a downscaled image -> its dominant color. */
export function dominantColorFromBitmap(bmp: ImageBitmap): string {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return FALLBACK.accent;
  ctx.drawImage(bmp, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;

  let r = 0;
  let g = 0;
  let b = 0;
  let wSum = 0;
  let ar = 0;
  let ag = 0;
  let ab = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    if (a < 0.5) continue;
    const [, s] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    const w = s * a; // weight vivid pixels
    r += data[i] * w;
    g += data[i + 1] * w;
    b += data[i + 2] * w;
    wSum += w;
    ar += data[i];
    ag += data[i + 1];
    ab += data[i + 2];
    n++;
  }
  if (wSum > 0.5) {
    return rgbToHex(r / wSum, g / wSum, b / wSum);
  }
  // Near-grayscale image: fall back to the plain average.
  return n > 0 ? rgbToHex(ar / n, ag / n, ab / n) : FALLBACK.accent;
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Relative luminance per WCAG 2.1. */
function luminance(r: number, g: number, b: number): number {
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/** Whichever of near-black / near-white has more contrast against this fill. */
function bestContrast(r: number, g: number, b: number): string {
  const l = luminance(r, g, b);
  const onDark = (l + 0.05) / 0.05;
  const onLight = 1.05 / (l + 0.05);
  return onDark >= onLight ? "#0a0a0c" : "#ffffff";
}
