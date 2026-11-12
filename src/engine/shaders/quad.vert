#version 300 es
// Attribute-free fullscreen triangle. vUV is 0..1, y-up (GL convention).
out vec2 vUV;
void main() {
  vUV = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(vUV * 2.0 - 1.0, 0.0, 1.0);
}
