#version 300 es
precision highp float;
// Cover-fit blit of an uploaded image into the source target.
in vec2 vUV;
out vec4 frag;
uniform sampler2D uImage;
uniform vec2 uResolution; // target res (px)
uniform vec2 uImageSize;  // source image (px)
uniform float uBrightness; // -1..1
uniform float uContrast;   // -1..1

void main() {
  float ar = uResolution.x / uResolution.y;
  float ir = uImageSize.x / uImageSize.y;
  vec2 s = (ar > ir) ? vec2(1.0, ir / ar) : vec2(ar / ir, 1.0);
  vec2 uv = (vUV - 0.5) * s + 0.5;
  // ImageBitmap uploads IGNORE UNPACK_FLIP_Y_WEBGL (the bitmap carries its own
  // orientation), so the texture row 0 is the top of the file while vUV is
  // y-up. Flip here, where it is explicit and behaves the same everywhere,
  // rather than depending on unpack state the spec says is disregarded.
  uv.y = 1.0 - uv.y;
  vec3 c = FETCH(texture(uImage, uv).rgb);
  c = gradeEncoded(c, uBrightness, uContrast, gl_FragCoord.xy);
  frag = vec4(STORE(c), 1.0);
}
