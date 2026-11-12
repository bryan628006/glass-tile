#version 300 es
precision highp float;

// The heart of the effect: lay a rounded-tile grid over the backdrop and shade
// each tile as an actual pane of glass -- a beveled dome with a real normal,
// Fresnel-weighted environment reflection, a GGX highlight, thickness-driven
// refraction with per-channel IOR, and Beer-Lambert absorption for tint.
//
// Two source textures, two distinct roles:
//   uField -- the big-sigma blurred glow. The aesthetic bed, and what the
//             grout shows. This is the "wall" the panes sit on.
//   uSrc   -- the full-resolution mipped source. The transmitted radiance:
//             what you actually see THROUGH the glass, displaced by refraction
//             and blurred by roughness via textureLod.
//
// Everything here is LINEAR light. The single encode to sRGB happens on the
// last line, because this pass writes to a plain RGBA8 target (screen/export).

in vec2 vUV;
out vec4 frag;

uniform sampler2D uField;
uniform sampler2D uSrc;
uniform vec2 uResolution;  // device px
uniform vec2 uSrcTexel;    // 1 / source resolution
uniform float uSrcLodMax;

// Tiles
uniform vec2 uTile;        // device px per axis (fit grid may differ them)
uniform int uGrid;         // 0 square, 1 hex, 2 brick
uniform float uGrout;      // device px
uniform float uRounding;   // 0..1
uniform float uJitter;     // 0..1
uniform float uGroutShade; // 0..1 how far the grout drops below the backdrop

// Glass
uniform float uThickness;    // cfg.refraction -- optical DEPTH: how far light walks
uniform float uRelief;       // 0..1 surface curvature, independent of depth
uniform float uFrost;        // 0..1 transmission blur
uniform float uSheen;        // 0..1 GGX specular intensity
uniform float uEdge;         // 0..1 Fresnel * environment strength
uniform float uDispersion;   // 0..1 per-channel IOR spread
uniform float uIOR;          // 1..2.2
uniform float uBevel;        // 0..1 bevel width as a fraction of the half-tile
uniform float uRough;        // 0.02..1 GGX lobe width
uniform float uTransmission; // 0..1 sharp backdrop vs. flat bed
uniform vec3 uTint;          // linear
uniform float uTintOp;       // 0..1 absorption density
uniform float uGrain;        // 0..1 static micro-roughness

// Environment, derived from the palette so the glass reflects its own scene.
uniform vec3 uEnvSky;
uniform vec3 uEnvGround;

// Light
uniform vec2 uLightDir; // -1..1; magnitude is elevation (0 = head-on)

// Falloff
uniform int uFalloffDir; // 0 none,1 top,2 bottom,3 left,4 right,5 tl,6 tr,7 bl,8 br
uniform float uFalloffSoft;
uniform float uFalloffAmt;
uniform vec3 uFalloffBg;
uniform int uTransparent; // 1 -> falloff fades to alpha instead of bg color

uniform float uTime;
uniform float uMotion; // 0 under prefers-reduced-motion

const float PI = 3.14159265359;
const float PERSP = 0.20;
// |grad(sd)| == 1 for a proper SDF in device px, so the AA band is a fixed
// half pixel. No fwidth() -- it is garbage across cell boundaries.
const float AA = 0.70711;

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

// Analytic outward normal. Continuous inside a cell, unlike dFdx(sd).
//
// `soft` blends the two candidate directions across the medial axis. The true
// gradient of a rounded box genuinely snaps from horizontal to vertical along
// the diagonals, which is invisible while the middle of the tile is a flat
// plateau but shows up as a hard X-shaped crease the moment the dome covers
// the centre. Blending rotates the normal smoothly instead, giving a pillow.
vec2 gradRoundBox(vec2 p, vec2 b, float r, float soft) {
  vec2 s = sign(p + 1e-9);
  vec2 q = abs(p) - b + r;
  vec2 m = max(q, 0.0);
  float l = length(m);
  if (l > 1e-6) return s * (m / l);
  float w = smoothstep(-soft, soft, q.x - q.y);
  return normalize(vec2(s.x * w, s.y * (1.0 - w)) + vec2(1e-9));
}

float sdHex(vec2 p, float r) {
  const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

// No cheap closed form for the hex; a central difference in local coords is
// still continuous because the cell id is held fixed.
vec2 gradHex(vec2 p, float r) {
  const float e = 0.5;
  vec2 g = vec2(sdHex(p + vec2(e, 0.0), r) - sdHex(p - vec2(e, 0.0), r),
                sdHex(p + vec2(0.0, e), r) - sdHex(p - vec2(0.0, e), r));
  return normalize(g + vec2(1e-9));
}

// Nearest hex center on a hex lattice (classic). Returns .xy local offset, .zw id.
vec4 hexCenter(vec2 p) {
  vec2 s = vec2(1.0, 1.7320508);
  vec4 hC = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
  vec4 h = vec4(p - hC.xy * s, p - (hC.zw + 0.5) * s);
  return dot(h.xy, h.xy) < dot(h.zw, h.zw)
    ? vec4(h.xy, hC.xy)
    : vec4(h.zw, hC.zw + 0.5);
}

// Two-band procedural environment with a soft horizon. Roughness widens the
// band. Uses exp(-q*q), never pow() -- a negative base is undefined in GLSL.
// The bands stay deliberately low-contrast: a hard sky/ground split reads as a
// chamfer shadow notched into every tile rather than as a reflection.
vec3 envColor(vec3 R, float rough) {
  float up = clamp(R.y * 0.5 + 0.5, 0.0, 1.0);
  float k = mix(0.08, 0.85, rough);
  vec3 sky = mix(uEnvGround, uEnvSky, smoothstep(0.5 - k, 0.5 + k, up));
  float q = (up - 0.5) / max(k * 0.7, 0.02);
  return sky + uEnvSky * (exp(-q * q) * 0.10);
}

// Screen-space offset for a ray crossing a slab of depth thickPx. The sign is
// DERIVED, not chosen: refract() returns T.x < 0 at the +x rim, so the sample
// contracts inward, which is exactly how a convex cap magnifies.
//
// maxPx bounds the walk to roughly the tile's own footprint. Unbounded, a
// grazing ray divides by a near-zero -T.z and fetches from hundreds of pixels
// away -- which does not read as a lens, it reads as unrelated color teleported
// in from across the canvas.
vec2 refractOffsetPx(vec3 N, vec3 V, float ior, float thickPx, float maxPx) {
  vec3 T = refract(-V, N, 1.0 / max(ior, 1.001));
  if (dot(T, T) < 1e-6) return vec2(0.0); // total internal reflection
  vec2 o = (T.xy / max(-T.z, 0.35)) * thickPx;
  float l = length(o);
  return l > maxPx ? o * (maxPx / l) : o;
}

float falloffMask() {
  if (uFalloffDir == 0) return 0.0;
  vec2 u = vUV; // y-up
  float coord;
  if (uFalloffDir == 1) coord = u.y;              // top
  else if (uFalloffDir == 2) coord = 1.0 - u.y;   // bottom
  else if (uFalloffDir == 3) coord = 1.0 - u.x;   // left
  else if (uFalloffDir == 4) coord = u.x;         // right
  else if (uFalloffDir == 5) coord = 0.5 * ((1.0 - u.x) + u.y);         // tl
  else if (uFalloffDir == 6) coord = 0.5 * (u.x + u.y);                 // tr
  else if (uFalloffDir == 7) coord = 0.5 * ((1.0 - u.x) + (1.0 - u.y)); // bl
  else coord = 0.5 * (u.x + (1.0 - u.y));                               // br
  float amt = uFalloffAmt * 1.15;
  float soft = mix(0.015, 0.55, uFalloffSoft);
  float start = 1.0 - amt;
  return smoothstep(start - soft, start + soft, coord);
}

void main() {
  vec2 res = uResolution;
  vec2 fragPx = vUV * res; // y-up device px
  vec2 tv = max(uTile, vec2(4.0));
  float tile = min(tv.x, tv.y); // scalar for thickness / frost / hex radius

  // ---- 1. Cell -> signed distance + analytic gradient ----
  float sd;
  float bmin;
  vec2 localPx;
  vec2 cellId;
  vec2 gxy;

  if (uGrid == 1) {
    float hr = tile * 0.58;
    vec4 hc = hexCenter(fragPx / hr);
    localPx = hc.xy * hr;
    cellId = hc.zw;
    float jit = 1.0 - uJitter * 0.5 * hash21(cellId + 3.7);
    float hrad = (hr * 0.95 - uGrout * 0.5) * jit;
    float rr = uRounding * 0.5 * hrad;
    float ri = max(hrad - rr, 1.0);
    sd = sdHex(localPx, ri) - rr;
    gxy = gradHex(localPx, ri);
    bmin = hrad;
  } else {
    vec2 fp = fragPx;
    float xoff = 0.0;
    if (uGrid == 2) {
      float row = floor(fp.y / tv.y);
      xoff = mod(row, 2.0) * 0.5 * tv.x;
      fp.x -= xoff;
    }
    cellId = floor(fp / tv);
    localPx = fragPx - ((cellId + 0.5) * tv + vec2(xoff, 0.0));
    float jit = 1.0 - uJitter * 0.5 * hash21(cellId + 1.3);
    vec2 b = (tv * 0.5 - vec2(uGrout * 0.5)) * jit;
    float r = uRounding * min(b.x, b.y);
    sd = sdRoundBox(localPx, b, r);
    gxy = gradRoundBox(localPx, b, r, max(1.0, bmin * 0.8));
    bmin = min(b.x, b.y);
  }

  float tileMask = 1.0 - smoothstep(-AA, AA, sd);
  vec3 bed = FETCH(texture(uField, vUV).rgb);

  // ---- 2..4. The glass. Skipped entirely on grout pixels. ----
  vec3 glass = vec3(0.0);
  if (tileMask > 0.0015) {
    // ---- The bezel ----
    // A large optically FLAT plateau with the bend packed into a narrow outer
    // ring. This shape is what reads as glass. A dome spread across the whole
    // tile distorts a little everywhere, which the eye reads as embossed
    // rubber; a flat centre plus a hard rim reads as a pane you can see
    // through, with the surroundings compressed into the edge.
    // Bevel 1.0 reaches bmin: a full dome with no plateau left. Capping this
    // below bmin left an irreducible flat panel in the middle of every tile
    // that no control could remove, which reads as inert padding inside a
    // frame rather than as one continuous pane.
    float bezelPx = max(1.5, mix(2.0, bmin, uBevel));
    float tRaw = -sd / bezelPx;
    float t = clamp(tRaw, 0.0, 1.0); // 0 at outline, 1 where it flattens
    float e = 1.0 - t;
    float hh = sqrt(max(1.0 - e * e, 0.0));              // height 0..1
    float dh = e * inversesqrt(max(1.0 - e * e, 0.012)); // |dh/dt|, steep at the rim

    // Relief shapes the surface; Depth decides how far light travels through
    // it. Keeping them separate lets you have a softly domed pane that still
    // bends hard, or a crisp one that barely does. The ceiling is high on
    // purpose: the near-grazing normal in the outermost pixels is what makes
    // the compressed, inverted sliver of the surroundings.
    float slope = min(dh * (0.35 + 1.65 * uRelief), 9.0);

    // Static micro-roughness. No uTime here, so the surface does not crawl.
    vec2 mn = vec2(hash21(fragPx * 0.63), hash21(fragPx * 0.63 + 17.1)) - 0.5;
    float rough = clamp(uRough + uGrain * 0.25, 0.02, 1.0);
    vec3 N = normalize(vec3(gxy * slope + mn * (uGrain * 1.5), 1.0));

    // Mild perspective. Orthographic (0,0,1) makes every tile identical and
    // reads as vinyl stickers rather than glass.
    vec2 ndc = (vUV * 2.0 - 1.0) * vec2(res.x / res.y, 1.0);
    vec3 V = normalize(vec3(-ndc * PERSP, 1.0));

    // The light widget magnitude is elevation: centre = head-on, edge = grazing.
    float l2l = min(dot(uLightDir, uLightDir), 0.97);
    vec3 L = normalize(vec3(uLightDir, sqrt(1.0 - l2l)));

    float NoV = clamp(dot(N, V), 1e-3, 1.0);
    float NoL = clamp(dot(N, L), 0.0, 1.0);
    vec3 H = normalize(L + V);
    float NoH = clamp(dot(N, H), 0.0, 1.0);
    float VoH = clamp(dot(V, H), 0.0, 1.0);

    // ---- Transmission ----
    // The slab is deep enough that the rim ray crosses the tile centre, which
    // is what flips the sliver. Safe to reach this far now only because the
    // steep normals are confined to a narrow ring -- spread across a whole
    // dome, the same numbers dragged unrelated colour over everything.
    float thickPx = uThickness * tile * 1.6;
    float maxPx = bmin * 2.6;
    // Frost radius -> mip level (level L has a 2^L device-px footprint), plus a
    // minification guard so the compressed rim does not alias. Kept light: a
    // glass edge should stay crisp.
    float lod = max(log2(max(1.0, uFrost * tile * 0.75)),
                    log2(1.0 + slope * uRelief * 0.35)) + rough * 3.0;
    lod = clamp(lod, 0.0, uSrcLodMax);

    vec3 behind;
    if (uDispersion > 0.004) {
      // Cauchy: blue is the shorter wavelength, so it sees a higher IOR and
      // bends MORE. The old model had this backwards.
      // Exaggerated well past a real Abbe number: at physical dispersion the
      // fringe is a sub-pixel tint, and this is a design tool, not a lens sim.
      float dn = uDispersion * 0.45;
      vec2 oR = refractOffsetPx(N, V, uIOR - dn, thickPx, maxPx);
      vec2 oG = refractOffsetPx(N, V, uIOR, thickPx, maxPx);
      vec2 oB = refractOffsetPx(N, V, uIOR + dn, thickPx, maxPx);
      behind = vec3(
        FETCH(textureLod(uSrc, vUV + oR * uSrcTexel, lod).rgb).r,
        FETCH(textureLod(uSrc, vUV + oG * uSrcTexel, lod).rgb).g,
        FETCH(textureLod(uSrc, vUV + oB * uSrcTexel, lod).rgb).b);
    } else {
      vec2 o = refractOffsetPx(N, V, uIOR, thickPx, maxPx);
      behind = FETCH(textureLod(uSrc, vUV + o * uSrcTexel, lod).rgb);
    }

    // Beer-Lambert: a longer optical path near the rim deepens the tint.
    // -log(tint) means a white tint gives sigma == 0, i.e. no absorption.
    float path = (uThickness * 0.6 + 0.4) * hh / max(NoV, 0.25);
    vec3 sigma = -log(max(uTint, vec3(0.004))) * (uTintOp * 3.0);
    vec3 transmitted = mix(bed, behind, uTransmission) * exp(-sigma * path);

    // ---- Reflection ----
    float ior = max(uIOR, 1.001);
    float f0s = (1.0 - ior) / (1.0 + ior);
    float F0 = f0s * f0s;
    float Fv = F0 + (1.0 - F0) * pow(1.0 - NoV, 5.0); // view -> rim
    float Fh = F0 + (1.0 - F0) * pow(1.0 - VoH, 5.0); // half -> highlight

    // Specular anti-aliasing.
    //
    // Across a narrow bezel the surface normal turns by far more than one lobe
    // width within a single pixel, so a low-roughness highlight is smaller than
    // the sample grid: it lands between pixels and renders as an isolated white
    // speck on the corner facing the light rather than as a glint. Widen the
    // lobe by how fast the normal is actually turning.
    //
    // Derived analytically rather than with fwidth(N): the normal depends on
    // sd and the cell id, both of which jump at cell boundaries, so screen-space
    // derivatives there are garbage. |grad(sd)| == 1 in device px, so
    // d(slope)/d(pixel) falls straight out of the bezel profile. On the plateau
    // t is clamped, the normal is constant, and the widening switches off.
    float bezelActive = 1.0 - smoothstep(0.98, 1.06, tRaw);
    float qc = max(1.0 - e * e, 0.012);
    float dSlope = bezelActive * (0.35 + 1.65 * uRelief) / (qc * sqrt(qc) * bezelPx);
    float aBase = max(rough * rough, 2.0e-3);
    float a = min(sqrt(aBase * aBase + dSlope * dSlope * 0.25), 1.0);
    float a2 = a * a;
    float dd = NoH * NoH * (a2 - 1.0) + 1.0;
    float D = a2 / (PI * dd * dd);
    float kv = a * 0.5;
    float Vg = 0.5 / max(mix(2.0 * NoL * NoV, NoL + NoV, kv), 1e-4);
    // Firefly clamp: D peaks in the hundreds at low roughness and would punch
    // holes in an 8-bit target. Kept low because the plateau normal is
    // CONSTANT -- the highlight there has no per-tile variation, so a high
    // ceiling turns an entire flat face white and makes the plateau boundary
    // read as a hard frame.
    float spec = min(D * Vg * NoL * Fh, 2.6) * uSheen;

    // Reflection REPLACES transmission rather than stacking on top of it --
    // a mix, not an add. Adding both is what turns a bright palette into mud.
    // The highlight is the one additive term, because it is a light source
    // rather than a redistribution of what is already behind the glass.
    // Capped below 1: a rim that goes fully reflective shows only the
    // environment, and since the lower half of that environment is dark the
    // tile ends up ringed in shadow -- which reads as pressed metal, not glass.
    float refl = clamp(Fv * (0.25 + uEdge), 0.0, 0.82);
    // Scale the environment by how lit the local scene is. The artwork is the
    // only light source here, so a pane sitting in a dark corner must not
    // reflect a brightly lit room -- a global two-band sky puts its horizon
    // exactly where a flat tile face reflects, and at 200x the brightness of a
    // near-black backdrop even 7% reflectance turns the corner to mud. The
    // soft knee keeps the directional bevel gradient wherever there IS light.
    float lum = dot(bed, vec3(0.2126, 0.7152, 0.0722));
    float lit = lum / (lum + 0.12);
    vec3 env = envColor(reflect(-V, N), rough) * lit + bed * 0.25;
    vec3 specCol = mix(uEnvSky, vec3(1.0), 0.72);
    // Scaled by the local-light knee for the same reason the rim is: the
    // artwork is the only light source, so a highlight cannot outshine it.
    glass = mix(transmitted, env, refl) + specCol * spec * lit;

    // ---- Rim light ----
    // A bright arc down the lit side of the bezel, and a fainter one opposite.
    // A broad Fresnel wash reads as a soft edge; this directed glint is what
    // the eye takes as a hard glass lip, and it holds up over any backdrop --
    // including a smooth gradient with nothing to refract.
    //
    // The exponent has to stay low. dot(gxy, ldn) reaches 1.0 at exactly ONE
    // point on the outline -- where the outward normal matches the light -- so
    // a high power collapses the arc into a hot speck on the corner instead of
    // running along the lit edges.
    float band = smoothstep(0.35, 1.0, 1.0 - t);
    vec2 ldn = normalize(uLightDir + vec2(1e-6));
    float facing = dot(gxy, ldn);
    float glint = band * pow(max(facing, 0.0), 1.2);
    float counter = band * pow(max(-facing, 0.0), 2.0);
    // Scaled by the same local-light knee as the environment. This is a
    // reflection, not an emitter: an unlit tile must not sprout a white speck
    // brighter than anything around it.
    // Sheen drives the rim too, not just the GGX lobe. On a flat plateau the
    // lobe is degenerate (constant normal, so it is all-or-nothing across the
    // whole face), which left the Specular slider doing almost nothing.
    // Roughness damps it, because rough glass has no crisp lip.
    glass += specCol * (glint * (0.05 + uSheen * 1.35) + counter * 0.18)
           * uEdge * lit * (1.0 - rough * 0.95);
  }

  // ---- 5. Grout is the backdrop, not a darkened copy of the tile ----
  float ao = smoothstep(0.0, max(uGrout, 1.0) * 1.4, sd); // contact shadow
  vec3 groutCol = bed * (1.0 - uGroutShade * 0.9) * mix(0.74, 1.0, ao);
  vec3 outCol = mix(groutCol, glass, tileMask);

  // ---- 6. Falloff, then the one and only encode ----
  float m = falloffMask();
  float alpha = 1.0;
  if (uTransparent == 1) {
    alpha = 1.0 - m;
  } else {
    outCol = mix(outCol, uFalloffBg, m);
  }

  vec3 srgb = linearToSrgb(outCol);
  srgb += (hash21(fragPx + uTime * uMotion * 60.0) - 0.5) / 255.0;
  frag = vec4(srgb * alpha, alpha); // premultiplied
}
