export const vertexShader = `#version 300 es
out vec2 v_uv;
void main() {
  vec2 position = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  v_uv = position;
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
}`

export const fragmentShader = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler3D;
in vec2 v_uv;
out vec4 out_color;
uniform sampler2D u_source;
uniform sampler3D u_lut;
uniform sampler2D u_leak;
uniform float u_lut_strength;
uniform float u_grain;
uniform float u_vignette;
uniform float u_leak_strength;
uniform uint u_seed;
uniform bool u_source_flip_y;
uniform vec2 u_viewport;
uniform vec2 u_leak_size;

float noise(vec2 pixel) {
  uint state = uint(pixel.x) * 747796405u + uint(pixel.y) * 2891336453u + u_seed * 277803737u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  word = (word >> 22u) ^ word;
  return float(word) / 4294967295.0;
}

vec2 leakUv(vec2 uv) {
  float outputAspect = u_viewport.x / u_viewport.y;
  float leakAspect = u_leak_size.x / max(u_leak_size.y, 1.0);
  if (leakAspect > outputAspect) {
    float visible = outputAspect / leakAspect;
    return vec2((uv.x - 0.5) * visible + 0.5, uv.y);
  }
  float visible = leakAspect / outputAspect;
  return vec2(uv.x, (uv.y - 0.5) * visible + 0.5);
}

void main() {
  vec2 sourceUv = u_source_flip_y ? vec2(v_uv.x, 1.0 - v_uv.y) : v_uv;
  vec4 source = texture(u_source, sourceUv);
  vec3 color = source.rgb;
  if (u_leak_strength > 0.0) {
    vec3 leak = texture(u_leak, leakUv(v_uv)).rgb;
    color = mix(color, 1.0 - (1.0 - color) * (1.0 - leak), u_leak_strength);
  }
  color = mix(color, texture(u_lut, color).rgb, u_lut_strength);
  float grain = (noise(gl_FragCoord.xy) - 0.5) * 2.0 * u_grain * (80.0 / 255.0);
  color = clamp(color + vec3(grain), 0.0, 1.0);
  vec2 normalized = v_uv * 2.0 - 1.0;
  float distance = min(1.0, sqrt(dot(normalized, normalized) / 2.0));
  color *= 1.0 - u_vignette * distance * distance * distance;
  out_color = vec4(clamp(color, 0.0, 1.0), source.a);
}`
