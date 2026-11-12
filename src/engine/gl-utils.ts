// Minimal WebGL2 helpers: program wrapper with cached uniforms, ping-pong
// render targets, and an attribute-free fullscreen draw (gl_VertexID triangle).

export function createGL(canvas: HTMLCanvasElement): WebGL2RenderingContext {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance",
  });
  if (!gl) throw new Error("WebGL2 is not available in this browser.");
  return gl;
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`Shader compile error:\n${log}\n---\n${src}`);
  }
  return sh;
}

/**
 * Splice a prelude in immediately after the #version directive, which GLSL
 * requires to be the very first thing in the source.
 */
export function withPrelude(src: string, prelude: string): string {
  if (!prelude) return src;
  const nl = src.indexOf("\n");
  if (src.startsWith("#version") && nl > -1) {
    return `${src.slice(0, nl + 1)}${prelude}\n${src.slice(nl + 1)}`;
  }
  return `${prelude}\n${src}`;
}

/** A compiled program with cached uniform locations and typed setters. */
export class Program {
  readonly program: WebGLProgram;
  private gl: WebGL2RenderingContext;
  private locs = new Map<string, WebGLUniformLocation | null>();
  private unit = 0;

  /** fsPrelude is spliced into the fragment source just after #version. */
  constructor(gl: WebGL2RenderingContext, vs: string, fs: string, fsPrelude = "") {
    this.gl = gl;
    const v = compile(gl, gl.VERTEX_SHADER, vs);
    const f = compile(gl, gl.FRAGMENT_SHADER, withPrelude(fs, fsPrelude));
    const p = gl.createProgram()!;
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(`Program link error:\n${gl.getProgramInfoLog(p)}`);
    }
    gl.deleteShader(v);
    gl.deleteShader(f);
    this.program = p;
  }

  use() {
    this.gl.useProgram(this.program);
    this.unit = 0;
    return this;
  }

  private loc(name: string): WebGLUniformLocation | null {
    let l = this.locs.get(name);
    if (l === undefined) {
      l = this.gl.getUniformLocation(this.program, name);
      this.locs.set(name, l);
    }
    return l;
  }

  f(name: string, x: number) {
    this.gl.uniform1f(this.loc(name), x);
    return this;
  }
  i(name: string, x: number) {
    this.gl.uniform1i(this.loc(name), x);
    return this;
  }
  v2(name: string, x: number, y: number) {
    this.gl.uniform2f(this.loc(name), x, y);
    return this;
  }
  v3(name: string, x: number, y: number, z: number) {
    this.gl.uniform3f(this.loc(name), x, y, z);
    return this;
  }
  /** Bind a texture to the next free unit and point a sampler uniform at it. */
  tex(name: string, texture: WebGLTexture) {
    const u = this.unit++;
    this.gl.activeTexture(this.gl.TEXTURE0 + u);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.uniform1i(this.loc(name), u);
    return this;
  }
}

export interface Target {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  w: number;
  h: number;
  /** Stored as SRGB8_ALPHA8 — the hardware handles the transfer function. */
  srgb: boolean;
  /** Carries a mip chain; must be regenerated after every draw into it. */
  mips: boolean;
}

export interface TargetOpts {
  linear?: boolean;
  srgb?: boolean;
  mips?: boolean;
}

/**
 * Is SRGB8_ALPHA8 usable as a color attachment? WebGL2 requires it, but the
 * whole linear pipeline hinges on it, so probe rather than assume.
 */
export function supportsSrgbTargets(gl: WebGL2RenderingContext): boolean {
  const tex = gl.createTexture();
  const fbo = gl.createFramebuffer();
  if (!tex || !fbo) return false;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteFramebuffer(fbo);
  gl.deleteTexture(tex);
  return ok;
}

export function createTarget(
  gl: WebGL2RenderingContext,
  w: number,
  h: number,
  opts: TargetOpts = {}
): Target {
  const { linear = true, srgb = false, mips = false } = opts;
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  const mag = linear ? gl.LINEAR : gl.NEAREST;
  const min = mips ? gl.LINEAR_MIPMAP_LINEAR : mag;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, min);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, mag);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const ifmt = srgb ? gl.SRGB8_ALPHA8 : gl.RGBA8;
  gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  // A LINEAR_MIPMAP_LINEAR texture with no allocated levels is INCOMPLETE and
  // samples as opaque black — including through textureLod. Keep it complete
  // from the moment it exists.
  if (mips) gl.generateMipmap(gl.TEXTURE_2D);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fbo, w, h, srgb, mips };
}

export function resizeTarget(gl: WebGL2RenderingContext, t: Target, w: number, h: number) {
  if (t.w === w && t.h === h) return;
  t.w = w;
  t.h = h;
  gl.bindTexture(gl.TEXTURE_2D, t.tex);
  const ifmt = t.srgb ? gl.SRGB8_ALPHA8 : gl.RGBA8;
  gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  if (t.mips) gl.generateMipmap(gl.TEXTURE_2D);
}

/** Regenerate a mip chain. Must run after every draw into a mipped target. */
export function refreshMips(gl: WebGL2RenderingContext, t: Target) {
  if (!t.mips) return;
  gl.bindTexture(gl.TEXTURE_2D, t.tex);
  gl.generateMipmap(gl.TEXTURE_2D);
}

/** Highest valid mip level for a w×h texture. */
export function maxLod(w: number, h: number): number {
  return Math.floor(Math.log2(Math.max(1, Math.max(w, h))));
}

export function deleteTarget(gl: WebGL2RenderingContext, t: Target) {
  gl.deleteTexture(t.tex);
  gl.deleteFramebuffer(t.fbo);
}

/** Bind a render target (or the default framebuffer when null) + set viewport. */
export function bindTarget(gl: WebGL2RenderingContext, t: Target | null) {
  if (t) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
    gl.viewport(0, 0, t.w, t.h);
  } else {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }
}

/** Draw the fullscreen triangle. Requires an empty VAO to be bound (see Renderer). */
export function drawFullscreen(gl: WebGL2RenderingContext) {
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

const s2l = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

/**
 * sRGB hex (#rgb / #rrggbb) -> [r,g,b] in 0..1. Linear by default, because
 * every call site feeds a shader uniform and the engine shades in linear light.
 */
export function hexToRGB(hex: string, linear = true): [number, number, number] {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h || "000000", 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  return linear ? [s2l(r), s2l(g), s2l(b)] : [r, g, b];
}
