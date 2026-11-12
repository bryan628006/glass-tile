#version 300 es
precision highp float;
// Separable Gaussian (5-tap, linear-sampling). uDir == (0,0) is a plain copy,
// used as the downsampling prep pass. Brightness/contrast now live in the
// source pass (glow.frag / image.frag), so this shader only ever filters.
in vec2 vUV;
out vec4 frag;
uniform sampler2D uTex;
uniform vec2 uTexel;  // 1 / source resolution
uniform vec2 uDir;    // blur axis * radius (in texels); (0,0) = copy
uniform float uSrcLod; // explicit mip level to read from

vec3 tap(vec2 uv) {
  return FETCH(textureLod(uTex, uv, uSrcLod).rgb);
}

void main() {
  vec3 c;
  if (uDir.x == 0.0 && uDir.y == 0.0) {
    // Downsampling copy. Reading an explicit LOD rather than level 0 turns a
    // point-sampled 4x4 reduction into a properly filtered one.
    c = tap(vUV);
  } else {
    vec2 o1 = uDir * uTexel * 1.3846153846;
    vec2 o2 = uDir * uTexel * 3.2307692308;
    c  = tap(vUV)      * 0.2270270270;
    c += tap(vUV + o1) * 0.3162162162;
    c += tap(vUV - o1) * 0.3162162162;
    c += tap(vUV + o2) * 0.0702702703;
    c += tap(vUV - o2) * 0.0702702703;
  }
  frag = vec4(STORE(c), 1.0);
}
