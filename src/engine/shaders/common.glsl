// Shared fragment-shader prelude. Spliced in directly after the #version line
// by Program (see gl-utils.ts), so it must not contain a #version of its own.

precision highp float;

// ---- Color space ----------------------------------------------------------
// The pipeline works in LINEAR light from the source pass all the way through
// the tile pass; tiles.frag performs the single encode to sRGB at the very end.
//
// Intermediate targets are SRGB8_ALPHA8, so the hardware handles the transfer
// on every read and write — which also means bilinear filtering and mipmap
// generation happen in linear space, something an explicit pow() cannot give
// you. Where those targets are unavailable we fall back to RGBA8 and do the
// conversion by hand; FETCH/STORE are the seams.

vec3 srgbToLinear(vec3 c) {
  c = max(c, 0.0);
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}

vec3 linearToSrgb(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

#ifdef MANUAL_SRGB
  #define FETCH(c) srgbToLinear(c)
  #define STORE(c) linearToSrgb(c)
#else
  #define FETCH(c) (c)
  #define STORE(c) (c)
#endif

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// Brightness/contrast graded in the ENCODED (perceptual) domain so the 0.5
// pivot behaves the way the sliders imply, then handed back as linear light.
// The dither belongs here too: 1 LSB is meaningful in sRGB, but applied to
// linear values it would be ~8 LSB in the shadows and invisible up top.
vec3 gradeEncoded(vec3 lin, float brightness, float contrast, vec2 seed) {
  vec3 s = linearToSrgb(lin);
  s += brightness;
  s = (s - 0.5) * (1.0 + contrast) + 0.5;
  s += (hash21(seed) - 0.5) / 255.0;
  return srgbToLinear(clamp(s, 0.0, 1.0));
}
