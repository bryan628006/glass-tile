import type { Renderer } from "../engine/Renderer";
import type { FalloffDir } from "../state/types";
import { getConfig } from "../state/store";
import { triggerDownload, pixelsToImageData } from "./png";

// Export the design as an SVG Figma imports as editable layers: each tile is a
// rounded-rect with a gradient (sheen) fill, sampled from the glow field.
// Pixel-only effects (refraction/frost/dispersion/jitter/hex) can't be vector,
// so those fall back to a single flat image embedded in the SVG.

type RGB = [number, number, number];
const clampByte = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
const mixTo = (c: RGB, t: RGB, k: number): RGB => [
  c[0] + (t[0] - c[0]) * k,
  c[1] + (t[1] - c[1]) * k,
  c[2] + (t[2] - c[2]) * k,
];
const rgbStr = (c: RGB) => `rgb(${clampByte(c[0])},${clampByte(c[1])},${clampByte(c[2])})`;

function normalize(v: [number, number]): [number, number] {
  const len = Math.hypot(v[0], v[1]);
  return len > 1e-4 ? [v[0] / len, v[1] / len] : [0, 1];
}

function sampleField(
  field: { data: Uint8ClampedArray; w: number; h: number },
  u: number,
  v: number
): RGB {
  const x = Math.min(field.w - 1, Math.max(0, Math.floor(u * field.w)));
  const y = Math.min(field.h - 1, Math.max(0, Math.floor(v * field.h)));
  const i = (y * field.w + x) * 4;
  return [field.data[i], field.data[i + 1], field.data[i + 2]];
}

// Gradient line (objectBoundingBox) pointing toward the fading edge.
function falloffVec(dir: FalloffDir): [number, number, number, number] {
  switch (dir) {
    case "top": return [0.5, 1, 0.5, 0];
    case "bottom": return [0.5, 0, 0.5, 1];
    case "left": return [1, 0.5, 0, 0.5];
    case "right": return [0, 0.5, 1, 0.5];
    case "tl": return [1, 1, 0, 0];
    case "tr": return [0, 1, 1, 0];
    case "bl": return [1, 0, 0, 1];
    case "br": return [0, 0, 1, 1];
    default: return [0, 0, 0, 1];
  }
}

function pixelsToPngDataUrl(pixels: Uint8ClampedArray, w: number, h: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.putImageData(pixelsToImageData(pixels, w, h), 0, 0);
  return canvas.toDataURL("image/png");
}

function download(svg: string) {
  triggerDownload(new Blob([svg], { type: "image/svg+xml" }), `glass-tile-${Date.now()}.svg`);
}

export interface SvgResult {
  editable: boolean;
  tiles: number;
}

export function exportFigmaSVG(renderer: Renderer, width: number, height: number): SvgResult {
  const cfg = getConfig();
  const head =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;

  // What breaks the vector approximation is how much of the TILE looks
  // unlike a flat gradient: area times magnitude. A deep pane with a narrow
  // bezel keeps a wide optically-flat plateau and vectorises well; a wide
  // bezel smears the whole face and does not. Rim, highlight and bevel shading
  // are all within-tile gradients an SVG can carry — only backdrop
  // displacement, LOD frost and source structure genuinely cannot.
  const distortion = cfg.bevel * cfg.refraction;
  const structured = cfg.glow.pattern !== "none" && cfg.glow.patternAmount > 0.08;
  const editable =
    cfg.grid !== "hex" &&
    cfg.jitter <= 0.001 &&
    distortion <= 0.3 &&
    cfg.frost <= 0.2 &&
    cfg.dispersion <= 0.35 &&
    !(cfg.mode === "glow" && structured);

  if (!editable) {
    const { pixels } = renderer.renderOffscreen(width, height, {});
    const href = pixelsToPngDataUrl(pixels, width, height);
    download(
      `${head}<image id="glass-tile" width="${width}" height="${height}" ` +
        `href="${href}" xlink:href="${href}"/></svg>`
    );
    return { editable: false, tiles: 0 };
  }

  const field = renderer.renderField(cfg, width, height);
  const dpr = width / (renderer.cssWidth || 1280);
  const tile = Math.max(6, cfg.tileSize * dpr);
  const grout = Math.max(0, cfg.grout * dpr);
  const half = Math.max(1, (tile - grout) / 2);
  const rxOuter = cfg.rounding * half;
  const rx = rxOuter.toFixed(2);
  const L = normalize(cfg.lightDir);
  const ex = (0.5 + L[0] * 0.5).toFixed(3);
  const ey = (0.5 - L[1] * 0.5).toFixed(3);
  const sx = (0.5 - L[0] * 0.5).toFixed(3);
  const sy = (0.5 + L[1] * 0.5).toFixed(3);

  // Same bevel profile the shader uses, so the vector and raster agree on how
  // much of the tile is rim and how much is flat plateau.
  const bevelPx = Math.max(1, 1.5 + (half - 1.5) * cfg.bevel);
  const innerHalf = Math.max(0, half - bevelPx);
  const rxInner = Math.max(0, rxOuter - bevelPx).toFixed(2);
  const strokeW = Math.max(0.6, bevelPx * 0.14).toFixed(2);

  // The glass reflects the palette, so the rim mixes toward the environment
  // sky — mixing toward pure white is the highlight-clipping defect
  // reappearing in the vector path.
  const envSky = hexToRgb255(cfg.glow.colors[0] ?? "#ffffff");

  // The grout is the backdrop now, so a fixed near-black was wrong for every
  // palette that is not dark.
  const groutCol = mixTo(hexToRgb255(cfg.glow.bg), [0, 0, 0], cfg.groutShade * 0.9);

  const defs: string[] = [];
  const rects: string[] = [];
  let gid = 0;
  const cols = Math.ceil(width / tile) + 1;
  const rows = Math.ceil(height / tile) + 1;

  for (let j = 0; j < rows; j++) {
    const xoff = cfg.grid === "brick" && j % 2 === 1 ? tile / 2 : 0;
    for (let i = 0; i < cols; i++) {
      const cx = (i + 0.5) * tile + xoff;
      const cy = (j + 0.5) * tile;
      if (cx + half < 0 || cy + half < 0 || cx - half > width || cy - half > height) continue;

      const col = sampleField(field, cx / width, cy / height);
      const light = mixTo(col, envSky, cfg.edgeHighlight * 0.55);
      const dark = mixTo(col, [0, 0, 0], cfg.edgeHighlight * 0.3);
      const id = `s${gid++}`;
      defs.push(
        `<linearGradient id="${id}" x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}">` +
          `<stop offset="0" stop-color="${rgbStr(dark)}"/>` +
          `<stop offset="1" stop-color="${rgbStr(light)}"/></linearGradient>`
      );
      const stroke =
        cfg.edgeHighlight > 0.01
          ? ` stroke="${rgbStr(light)}" stroke-opacity="${(cfg.edgeHighlight * 0.5).toFixed(3)}" stroke-width="${strokeW}"`
          : "";
      // Two rects, not one: a single gradient-filled rounded rect cannot say
      // "shaded bevel ring around a flat plateau", which is what the tile now
      // actually is.
      rects.push(
        `<rect x="${(cx - half).toFixed(2)}" y="${(cy - half).toFixed(2)}" ` +
          `width="${(half * 2).toFixed(2)}" height="${(half * 2).toFixed(2)}" ` +
          `rx="${rx}" ry="${rx}" fill="url(#${id})"${stroke}/>`
      );
      if (innerHalf > 0.75) {
        rects.push(
          `<rect x="${(cx - innerHalf).toFixed(2)}" y="${(cy - innerHalf).toFixed(2)}" ` +
            `width="${(innerHalf * 2).toFixed(2)}" height="${(innerHalf * 2).toFixed(2)}" ` +
            `rx="${rxInner}" ry="${rxInner}" fill="${rgbStr(col)}"/>`
        );
      }
    }
  }

  let falloff = "";
  if (cfg.falloff.dir !== "none" && cfg.falloff.amount > 0.001) {
    const [x1, y1, x2, y2] = falloffVec(cfg.falloff.dir);
    const soft = 0.02 + cfg.falloff.softness * 0.5;
    const start = Math.max(0, 1 - cfg.falloff.amount - soft).toFixed(3);
    falloff =
      `<defs><linearGradient id="falloff" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">` +
      `<stop offset="${start}" stop-color="${cfg.falloff.bg}" stop-opacity="0"/>` +
      `<stop offset="1" stop-color="${cfg.falloff.bg}" stop-opacity="1"/></linearGradient></defs>` +
      `<rect id="falloff-layer" width="${width}" height="${height}" fill="url(#falloff)"/>`;
  }

  download(
    `${head}<defs>${defs.join("")}</defs>` +
      `<rect id="background" width="${width}" height="${height}" fill="${rgbStr(groutCol)}"/>` +
      `<g id="tiles">${rects.join("")}</g>` +
      falloff +
      `</svg>`
  );
  return { editable: true, tiles: gid };
}

function hexToRgb255(hex: string): RGB {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h || "000000", 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
