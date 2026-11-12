#version 300 es
precision highp float;

// Generates the glow "field" the tiles sit over. One color background with
// 1-3 color stops composited along the chosen glow shape.
// Colors arrive LINEAR (hexToRGB decodes); compositing happens in linear light.

in vec2 vUV;
out vec4 frag;

uniform vec2 uResolution;
uniform int uShape;        // 0 radial, 1 arc/band, 2 linear, 3 corner
uniform vec3 uColors[3];
uniform int uColorCount;   // 1..3
uniform vec3 uBg;
uniform vec2 uPos;         // glow center, 0..1 (y-up)
uniform float uSpread;     // 0..1
uniform float uAngle;      // degrees (linear / arc / corner direction)
uniform float uBrightness; // -1..1
uniform float uContrast;   // -1..1
uniform int uPattern;        // 0 none, 1 grain, 2 rings, 3 weave
uniform float uPatternAmt;   // 0..1
uniform float uPatternScale; // 0..1

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

// Structure for the glass to bend.
//
// A gradient carries no detail above the tile scale, so a lens over one has
// literally nothing to refract and can only ever read as moulded plastic. This
// layer is the refraction target: it rides on the SHARP source the tiles
// transmit, while the blurred bed the grout shows stays smooth.
float patternValue(vec2 p) {
  // Calibrated so the features land FINER than one tile. Structure coarser
  // than the lens cannot be seen being bent -- it just shifts the whole tile.
  float s = mix(4.0, 30.0, uPatternScale);
  if (uPattern == 1) return fbm(p * s * 3.2) - 0.5;
  if (uPattern == 2) return 0.5 * sin(length(p) * s * 14.0);
  if (uPattern == 3) return 0.5 * sin(p.x * s * 8.0) * sin(p.y * s * 8.0);
  return 0.0;
}

vec3 pickStop(float t) {
  t = clamp(t, 0.0, 1.0);
  if (uColorCount <= 1) return uColors[0];
  if (uColorCount == 2) return mix(uColors[0], uColors[1], t);
  if (t < 0.5) return mix(uColors[0], uColors[1], t * 2.0);
  return mix(uColors[1], uColors[2], (t - 0.5) * 2.0);
}

void main() {
  vec2 uv = vUV;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = (uv - uPos) * vec2(aspect, 1.0);
  float spread = max(uSpread, 0.001);
  float ca = cos(radians(uAngle));
  float sa = sin(radians(uAngle));

  float g;        // glow intensity 0..1 (1 at core)
  float stopT;    // 0 at core -> 1 at fringe

  if (uShape == 1) {
    // Horizontal arc / band that gently bows. Rotate into the band's own frame
    // first, so the Angle slider actually steers it.
    vec2 q = uPos + mat2(ca, -sa, sa, ca) * (uv - uPos);
    float curve = q.x - uPos.x;
    float yc = uPos.y - 0.18 * curve * curve / spread;
    float d = abs(q.y - yc);
    g = 1.0 - smoothstep(0.0, spread, d);
    stopT = d / spread;
  } else if (uShape == 2) {
    // Linear gradient across the field.
    vec2 dir = vec2(ca, sa);
    float t = dot(uv - uPos, dir) / spread;
    stopT = clamp(0.5 + t, 0.0, 1.0);
    g = 1.0; // gradient covers the whole field
  } else if (uShape == 3) {
    // Corner wash: an L1 (diamond) falloff, which reads as light spilling from
    // a corner rather than as another round blob.
    vec2 q = mat2(ca, -sa, sa, ca) * p;
    float d = (abs(q.x) + abs(q.y)) * 0.70711;
    g = pow(1.0 - smoothstep(0.0, spread, d), 1.6);
    stopT = d / spread;
  } else {
    // Radial blob.
    float d = length(p);
    g = 1.0 - smoothstep(0.0, spread, d);
    g = pow(g, 1.25);
    stopT = d / spread;
  }

  vec3 col;
  if (uShape == 2) {
    col = pickStop(stopT);
  } else {
    col = mix(uBg, pickStop(stopT), clamp(g, 0.0, 1.0));
  }

  // Modulate rather than add, so the pattern rides the glow and never lifts
  // the background out of black.
  if (uPattern != 0) {
    col *= 1.0 + patternValue(p) * uPatternAmt * 0.95;
  }

  // Grade here, before the blur chain, so the sharp source the glass refracts
  // and the blurred bed the grout shows agree on exposure. Also dithers.
  col = gradeEncoded(col, uBrightness, uContrast, gl_FragCoord.xy);

  frag = vec4(STORE(col), 1.0);
}
