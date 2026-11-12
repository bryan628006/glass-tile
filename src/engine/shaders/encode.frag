#version 300 es
precision highp float;
// Re-encode a linear-light target into sRGB bytes in a plain RGBA8 target.
// Used just before readPixels: drivers disagree about whether reading an
// SRGB8_ALPHA8 attachment yields the stored bytes or decoded values, and the
// SVG exporter needs sRGB either way.
in vec2 vUV;
out vec4 frag;
uniform sampler2D uTex;

void main() {
  frag = vec4(linearToSrgb(FETCH(texture(uTex, vUV).rgb)), 1.0);
}
