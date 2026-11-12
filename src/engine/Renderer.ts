import {
  createGL,
  Program,
  createTarget,
  resizeTarget,
  refreshMips,
  maxLod,
  bindTarget,
  drawFullscreen,
  deleteTarget,
  hexToRGB,
  supportsSrgbTargets,
  type Target,
} from "./gl-utils";
import { getConfig, useStore } from "../state/store";
import type { Config, GridType, FalloffDir, GlowPattern } from "../state/types";

import quadVert from "./shaders/quad.vert?raw";
import commonGlsl from "./shaders/common.glsl?raw";
import glowFrag from "./shaders/glow.frag?raw";
import imageFrag from "./shaders/image.frag?raw";
import blurFrag from "./shaders/blur.frag?raw";
import encodeFrag from "./shaders/encode.frag?raw";
import tilesFrag from "./shaders/tiles.frag?raw";

const GRID_IDX: Record<GridType, number> = { square: 0, hex: 1, brick: 2 };
const PATTERN_IDX: Record<GlowPattern, number> = {
  none: 0, grain: 1, rings: 2, weave: 3,
};
const FALLOFF_IDX: Record<FalloffDir, number> = {
  none: 0, top: 1, bottom: 2, left: 3, right: 4, tl: 5, tr: 6, bl: 7, br: 8,
};

// What the glass reflects when the source is a photo rather than a palette:
// a neutral studio pair, so the highlights stay believable on any image.
const IMAGE_ENV_SKY = "#c4cede";
const IMAGE_ENV_GROUND = "#0a0a0e";

type RGB = [number, number, number];
const mix3 = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const hex2 = (n: number) => n.toString(16).padStart(2, "0");
function rgbaToHex(p: Uint8Array): string {
  const base = `#${hex2(p[0])}${hex2(p[1])}${hex2(p[2])}`;
  return p[3] < 255 ? `${base}${hex2(p[3])}` : base;
}

export interface Readout {
  w: number;
  h: number;
  hex: string;
}

/** Owns one WebGL2 context and the full multi-pass pipeline. */
export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private glow: Program;
  private image: Program;
  private blur: Program;
  private encode: Program;
  private tiles: Program;

  private srcFull: Target; // sharp, mipped, graded source — the transmitted view
  private blurA: Target;
  private blurB: Target;
  private field: Target; // last-written blur (points at blurA/blurB) — the bed

  private srgbOK = true;
  private srcLodMax = 0;

  private imageTex: WebGLTexture | null = null;
  private imageW = 1;
  private imageH = 1;
  private lastImage: ImageBitmap | null = null;

  private dpr = 1;
  private vw = 1; // device px
  private vh = 1;
  private cssW = 1; // CSS px (for the readout)
  private cssH = 1;
  private frameCount = 0;
  private lastSourceRev = -1;
  private lastVW = -1;
  private lastVH = -1;

  /** Live telemetry for the top readout bar (dimensions + cursor color). */
  readout: Readout = { w: 0, h: 0, hex: "" };

  // Cursor-bend spring (smoothed light offset).
  private bendPos: [number, number] = [0, 0];
  private bendVel: [number, number] = [0, 0];
  private pointer: [number, number] = [0.5, 0.5]; // DOM-normalized (y-down)
  private pointerInside = false;

  // Cached rather than polled: matchMedia on every frame is not free.
  private reducedMotion = false;
  private motionMq: MediaQueryList | null = null;
  private onMotionChange: (() => void) | null = null;

  private raf = 0;
  private prevT = 0;
  private startT = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.gl = createGL(canvas);
    const gl = this.gl;

    // WebGL2 requires a bound VAO to draw; an empty one is fine.
    gl.bindVertexArray(gl.createVertexArray());
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

    // The pipeline shades in linear light. SRGB8_ALPHA8 intermediates let the
    // hardware do the transfer on read/write — which also means filtering and
    // mip generation happen in linear space. Where that is unavailable, the
    // shaders convert by hand instead.
    this.srgbOK = supportsSrgbTargets(gl);
    const prelude = this.srgbOK ? commonGlsl : `#define MANUAL_SRGB 1\n${commonGlsl}`;

    this.glow = new Program(gl, quadVert, glowFrag, prelude);
    this.image = new Program(gl, quadVert, imageFrag, prelude);
    this.blur = new Program(gl, quadVert, blurFrag, prelude);
    this.encode = new Program(gl, quadVert, encodeFrag, prelude);
    this.tiles = new Program(gl, quadVert, tilesFrag, prelude);

    this.srcFull = createTarget(gl, 1, 1, { srgb: this.srgbOK, mips: true });
    this.blurA = createTarget(gl, 1, 1, { srgb: this.srgbOK });
    this.blurB = createTarget(gl, 1, 1, { srgb: this.srgbOK });
    this.field = this.blurA;

    if (typeof matchMedia !== "undefined") {
      const mq = matchMedia("(prefers-reduced-motion: reduce)");
      this.reducedMotion = mq.matches;
      this.onMotionChange = () => {
        this.reducedMotion = mq.matches;
      };
      mq.addEventListener("change", this.onMotionChange);
      this.motionMq = mq;
    }

    canvas.addEventListener("webglcontextlost", (e) => e.preventDefault());
  }

  setPointer(x01: number, y01: number, inside: boolean) {
    this.pointer = [x01, y01];
    this.pointerInside = inside;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    this.dpr = dpr;
    this.vw = w;
    this.vh = h;
    this.cssW = Math.round(rect.width);
    this.cssH = Math.round(rect.height);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  /** Upload (or clear) the source image. Called when the store's image changes. */
  private syncImage(image: ImageBitmap | null) {
    if (image === this.lastImage) return;
    this.lastImage = image;
    const gl = this.gl;
    if (this.imageTex) {
      gl.deleteTexture(this.imageTex);
      this.imageTex = null;
    }
    if (image) {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      // Mipped, so the cover-fit blit of a large photo minifies cleanly.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const ifmt = this.srgbOK ? gl.SRGB8_ALPHA8 : gl.RGBA;
      gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.generateMipmap(gl.TEXTURE_2D);
      this.imageTex = tex;
      this.imageW = image.width;
      this.imageH = image.height;
    }
  }

  /**
   * Build both source textures at w×h:
   *   srcFull — sharp, graded, mipped. What the glass transmits.
   *   field   — the blurred bed. What the grout shows.
   */
  private buildField(cfg: Config, w: number, h: number) {
    const gl = this.gl;
    resizeTarget(gl, this.srcFull, w, h);
    bindTarget(gl, this.srcFull);

    // Brightness/contrast are applied HERE, not on the blur prep pass, so the
    // sharp source and the blurred bed agree on exposure.
    if (cfg.mode === "upload" && this.imageTex) {
      this.image
        .use()
        .tex("uImage", this.imageTex)
        .v2("uResolution", w, h)
        .v2("uImageSize", this.imageW, this.imageH)
        .f("uBrightness", cfg.brightness * 0.5)
        .f("uContrast", cfg.contrast);
      drawFullscreen(gl);
    } else {
      const g = cfg.glow;
      const c0 = hexToRGB(g.colors[0] ?? "#ffffff");
      const c1 = hexToRGB(g.colors[1] ?? g.colors[0] ?? "#ffffff");
      const c2 = hexToRGB(g.colors[2] ?? g.colors[1] ?? g.colors[0] ?? "#ffffff");
      const bg = hexToRGB(g.bg);
      const shape = { radial: 0, arc: 1, linear: 2, corner: 3 }[g.shape];
      this.glow
        .use()
        .v2("uResolution", w, h)
        .i("uShape", shape)
        .i("uColorCount", Math.max(1, Math.min(3, g.colors.length)))
        .v3("uColors[0]", c0[0], c0[1], c0[2])
        .v3("uColors[1]", c1[0], c1[1], c1[2])
        .v3("uColors[2]", c2[0], c2[1], c2[2])
        .v3("uBg", bg[0], bg[1], bg[2])
        .v2("uPos", g.pos[0], 1.0 - g.pos[1]) // UI is y-down
        .f("uSpread", g.spread)
        .f("uAngle", g.angle)
        .i("uPattern", PATTERN_IDX[g.pattern])
        .f("uPatternAmt", g.patternAmount)
        .f("uPatternScale", g.patternScale)
        .f("uBrightness", cfg.brightness * 0.5)
        .f("uContrast", cfg.contrast);
      drawFullscreen(gl);
    }

    // Blur (downsampling for large radii).
    const bdev = cfg.sourceBlur * this.dpr;
    const factor = bdev <= 20 ? 1 : bdev <= 70 ? 2 : 4;
    const bw = Math.max(1, Math.ceil(w / factor));
    const bh = Math.max(1, Math.ceil(h / factor));
    resizeTarget(gl, this.blurA, bw, bh);
    resizeTarget(gl, this.blurB, bw, bh);

    // Bind the prep target FIRST so srcFull stops being the color attachment
    // — generateMipmap on an attached texture is undefined.
    bindTarget(gl, this.blurA);
    refreshMips(gl, this.srcFull);
    this.srcLodMax = maxLod(w, h);

    // Prep: downsampling copy. Reading an explicit LOD instead of level 0 turns
    // a point-sampled 4x4 reduction into a properly filtered one.
    this.blur
      .use()
      .tex("uTex", this.srcFull.tex)
      .v2("uTexel", 1 / w, 1 / h)
      .v2("uDir", 0, 0)
      .f("uSrcLod", Math.log2(factor));
    drawFullscreen(gl);

    let read = this.blurA;
    let write = this.blurB;
    if (bdev > 0.5) {
      const iter = bdev <= 20 ? 1 : bdev <= 70 ? 2 : 3;
      const step = bdev / factor / iter;
      for (let i = 0; i < iter; i++) {
        // Horizontal
        bindTarget(gl, write);
        this.blur
          .use()
          .tex("uTex", read.tex)
          .v2("uTexel", 1 / bw, 1 / bh)
          .v2("uDir", step, 0)
          .f("uSrcLod", 0);
        drawFullscreen(gl);
        [read, write] = [write, read];
        // Vertical
        bindTarget(gl, write);
        this.blur
          .use()
          .tex("uTex", read.tex)
          .v2("uTexel", 1 / bw, 1 / bh)
          .v2("uDir", 0, step)
          .f("uSrcLod", 0);
        drawFullscreen(gl);
        [read, write] = [write, read];
      }
    }
    this.field = read;
  }

  /**
   * Tile size in device px, per axis.
   *
   * With fitGrid on, each axis is rounded to a whole number of tiles so the
   * frame ends on a complete row and column instead of slicing one in half —
   * the difference between output that reads as a finished asset and output
   * that reads as a cropped screenshot. Tiles go very slightly non-square to
   * pay for it, which is imperceptible at any sane tile count. Hex has no
   * equivalent snap, so it keeps square cells.
   */
  private tileVec(cfg: Config, w: number, h: number): [number, number] {
    const t = Math.max(4, cfg.tileSize * this.dpr);
    if (!cfg.fitGrid || cfg.grid === "hex") return [t, t];
    return [w / Math.max(1, Math.round(w / t)), h / Math.max(1, Math.round(h / t))];
  }

  /** Compose the tile/glass pass into `target` (null = screen). */
  private composeTiles(
    cfg: Config,
    w: number,
    h: number,
    target: Target | null,
    light: [number, number],
    transparent: boolean,
    time: number
  ) {
    const gl = this.gl;
    bindTarget(gl, target);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const tint = hexToRGB(cfg.tint);
    const fbg = hexToRGB(cfg.falloff.bg);
    // The glass reflects the scene it lives in: the palette itself.
    const isImg = cfg.mode === "upload" && !!this.imageTex;
    const sky = hexToRGB(isImg ? IMAGE_ENV_SKY : cfg.glow.colors[0] ?? "#ffffff");
    // The ground is lifted toward the sky rather than used raw. A near-black
    // backdrop would make the lower half of the environment a void, which
    // reads as a shadow notched into every bevel instead of a reflection.
    const ground = mix3(hexToRGB(isImg ? IMAGE_ENV_GROUND : cfg.glow.bg), sky, 0.4);

    this.tiles
      .use()
      .tex("uField", this.field.tex)
      .tex("uSrc", this.srcFull.tex)
      .v2("uResolution", w, h)
      .v2("uSrcTexel", 1 / w, 1 / h)
      .f("uSrcLodMax", this.srcLodMax)
      .v2("uTile", ...this.tileVec(cfg, w, h))
      .i("uGrid", GRID_IDX[cfg.grid])
      .f("uGrout", cfg.grout * this.dpr)
      .f("uRounding", cfg.rounding)
      .f("uJitter", cfg.jitter)
      .f("uGroutShade", cfg.groutShade)
      .f("uThickness", cfg.refraction)
      .f("uRelief", cfg.relief)
      .f("uFrost", cfg.frost)
      .f("uSheen", cfg.sheen)
      .f("uEdge", cfg.edgeHighlight)
      .f("uDispersion", cfg.dispersion)
      .f("uIOR", cfg.ior)
      .f("uBevel", cfg.bevel)
      .f("uRough", cfg.roughness)
      .f("uTransmission", cfg.transmission)
      .v3("uTint", tint[0], tint[1], tint[2])
      .f("uTintOp", cfg.tintOpacity)
      .f("uGrain", cfg.grain)
      .v3("uEnvSky", sky[0], sky[1], sky[2])
      .v3("uEnvGround", ground[0], ground[1], ground[2])
      .f("uTime", time)
      .f("uMotion", this.reducedMotion ? 0 : 1)
      .v2("uLightDir", light[0], light[1])
      .i("uFalloffDir", FALLOFF_IDX[cfg.falloff.dir])
      .f("uFalloffSoft", cfg.falloff.softness)
      .f("uFalloffAmt", cfg.falloff.amount)
      .v3("uFalloffBg", fbg[0], fbg[1], fbg[2])
      .i("uTransparent", transparent ? 1 : 0);
    drawFullscreen(gl);
  }

  /** Effective light direction, including the spring-smoothed cursor bend. */
  private stepLight(cfg: Config, dt: number, bendOverride?: [number, number]): [number, number] {
    let targetX = 0;
    let targetY = 0;
    if (bendOverride) {
      targetX = bendOverride[0] * cfg.bendStrength;
      targetY = bendOverride[1] * cfg.bendStrength;
    } else if (cfg.bendToCursor && this.pointerInside) {
      const gx = (this.pointer[0] - 0.5) * 2;
      const gy = (0.5 - this.pointer[1]) * 2; // to y-up
      targetX = gx * cfg.bendStrength;
      targetY = gy * cfg.bendStrength;
    }

    if (this.reducedMotion) {
      this.bendPos = [targetX, targetY];
    } else {
      // Critically-damped-ish spring.
      const stiff = 90;
      const damp = 14;
      for (let i = 0; i < 2; i++) {
        const t = i === 0 ? targetX : targetY;
        const a = (t - this.bendPos[i]) * stiff - this.bendVel[i] * damp;
        this.bendVel[i] += a * dt;
        this.bendPos[i] += this.bendVel[i] * dt;
      }
    }
    return [cfg.lightDir[0] + this.bendPos[0], cfg.lightDir[1] + this.bendPos[1]];
  }

  private frame = (t: number) => {
    this.raf = requestAnimationFrame(this.frame);
    if (!this.startT) this.startT = t;
    const dt = Math.min((t - this.prevT) / 1000 || 0, 0.05);
    this.prevT = t;

    const { config: cfg, sourceRev, image } = useStore.getState();
    this.syncImage(image);

    this.resize();
    const needSource =
      sourceRev !== this.lastSourceRev ||
      this.vw !== this.lastVW ||
      this.vh !== this.lastVH;
    if (needSource) {
      this.buildField(cfg, this.vw, this.vh);
      this.lastSourceRev = sourceRev;
      this.lastVW = this.vw;
      this.lastVH = this.vh;
    }

    const light = this.stepLight(cfg, dt);
    const time = (t - this.startT) / 1000;
    this.composeTiles(cfg, this.vw, this.vh, null, light, false, time);

    // Readout (dimensions always; cursor hex sampled occasionally to avoid stalls).
    this.frameCount++;
    this.readout.w = this.cssW;
    this.readout.h = this.cssH;
    if (this.pointerInside && this.frameCount % 4 === 0) {
      const px = Math.min(this.vw - 1, Math.max(0, Math.round(this.pointer[0] * this.vw)));
      const py = Math.min(this.vh - 1, Math.max(0, Math.round((1 - this.pointer[1]) * this.vh)));
      const p = new Uint8Array(4);
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
      this.gl.readPixels(px, py, 1, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, p);
      this.readout.hex = rgbaToHex(p);
    }
  };

  start() {
    if (!this.raf) {
      this.prevT = performance.now();
      this.raf = requestAnimationFrame(this.frame);
    }
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /**
   * Render one full-pipeline frame at an arbitrary resolution into an RGBA
   * pixel buffer (top-left origin). Used by PNG/GIF/WebM export.
   */
  renderOffscreen(
    width: number,
    height: number,
    opts: { transparent?: boolean; bend?: [number, number]; time?: number } = {}
  ): { pixels: Uint8ClampedArray; width: number; height: number } {
    return this.renderConfigToPixels(getConfig(), width, height, opts);
  }

  private renderConfigToPixels(
    cfg: Config,
    width: number,
    height: number,
    opts: {
      transparent?: boolean;
      bend?: [number, number];
      time?: number;
      dprOverride?: number;
    } = {}
  ): { pixels: Uint8ClampedArray; width: number; height: number } {
    const gl = this.gl;
    const prevDpr = this.dpr;
    // Scale tile/grout/blur px by the export-to-screen ratio so the exported
    // image's tile density matches what the user sees on the stage.
    this.dpr =
      opts.dprOverride ?? (this.cssW > 1 ? width / this.cssW : width / 1280);

    // Plain RGBA8: tiles.frag encodes to sRGB itself, so readPixels gets the
    // exact bytes the PNG wants.
    const out = createTarget(gl, width, height);
    this.buildField(cfg, width, height);
    const light: [number, number] = opts.bend
      ? [cfg.lightDir[0] + opts.bend[0] * cfg.bendStrength, cfg.lightDir[1] + opts.bend[1] * cfg.bendStrength]
      : [cfg.lightDir[0] + this.bendPos[0], cfg.lightDir[1] + this.bendPos[1]];
    this.composeTiles(cfg, width, height, out, light, !!opts.transparent, opts.time ?? 0);

    const buf = new Uint8Array(width * height * 4);
    bindTarget(gl, out);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    deleteTarget(gl, out);

    // Flip rows (GL is bottom-up) and un-premultiply alpha for PNG.
    const flipped = new Uint8ClampedArray(width * height * 4);
    const row = width * 4;
    for (let y = 0; y < height; y++) {
      const src = (height - 1 - y) * row;
      const dst = y * row;
      for (let x = 0; x < row; x += 4) {
        const a = buf[src + x + 3];
        const inv = a === 0 ? 0 : 255 / a;
        flipped[dst + x] = a === 0 ? 0 : Math.min(255, buf[src + x] * inv);
        flipped[dst + x + 1] = a === 0 ? 0 : Math.min(255, buf[src + x + 1] * inv);
        flipped[dst + x + 2] = a === 0 ? 0 : Math.min(255, buf[src + x + 2] * inv);
        flipped[dst + x + 3] = a;
      }
    }

    // Force the live loop to rebuild its field at screen size next frame.
    this.lastSourceRev = -1;
    this.dpr = prevDpr;
    return { pixels: flipped, width, height };
  }

  /**
   * Build the source field at width×height and read it back (top-left origin).
   * Used by the Figma/SVG export to sample each tile's local color.
   */
  renderField(cfg: Config, width: number, height: number): {
    data: Uint8ClampedArray;
    w: number;
    h: number;
  } {
    const gl = this.gl;
    const prevDpr = this.dpr;
    this.dpr = this.cssW > 1 ? width / this.cssW : width / 1280;
    this.buildField(cfg, width, height);
    const f = this.field;

    // Re-encode into a plain RGBA8 target first. Drivers disagree about whether
    // readPixels on an SRGB8_ALPHA8 attachment yields stored or decoded bytes;
    // going through an explicit encode makes the result unambiguous.
    const out = createTarget(gl, f.w, f.h);
    bindTarget(gl, out);
    this.encode.use().tex("uTex", f.tex);
    drawFullscreen(gl);

    const buf = new Uint8Array(f.w * f.h * 4);
    gl.readPixels(0, 0, f.w, f.h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    deleteTarget(gl, out);

    // Flip rows (GL is bottom-up). Field is opaque, so no un-premultiply needed.
    const data = new Uint8ClampedArray(f.w * f.h * 4);
    const row = f.w * 4;
    for (let y = 0; y < f.h; y++) {
      const src = (f.h - 1 - y) * row;
      data.set(buf.subarray(src, src + row), y * row);
    }
    this.lastSourceRev = -1;
    this.dpr = prevDpr;
    return { data, w: f.w, h: f.h };
  }

  /** Current CSS width (for export density math). */
  get cssWidth() {
    return this.cssW;
  }

  /** Render a small preview of an arbitrary config to a PNG data URL (presets). */
  renderPreview(cfg: Config, width: number, height: number): string {
    // A thumbnail is ~170px wide. At stage density its tiles would be a dozen
    // pixels across and every preset would wash out to a flat gradient, so aim
    // for a legible handful of tiles instead — the picker is there to show the
    // material, not the density.
    const dprOverride = width / Math.max(1, cfg.tileSize * 6);
    const { pixels } = this.renderConfigToPixels(cfg, width, height, { dprOverride });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    const img = new ImageData(width, height);
    img.data.set(pixels);
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL("image/png");
  }

  dispose() {
    this.stop();
    const gl = this.gl;
    if (this.motionMq && this.onMotionChange) {
      this.motionMq.removeEventListener("change", this.onMotionChange);
    }
    if (this.imageTex) gl.deleteTexture(this.imageTex);
    [this.srcFull, this.blurA, this.blurB].forEach((t) => deleteTarget(gl, t));
  }
}
