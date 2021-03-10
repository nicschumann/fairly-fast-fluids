precision highp float;
precision highp sampler2D;

varying vec2 vUv;

uniform sampler2D uSource;
uniform vec2 uTexelSize;
uniform vec2 uOrigin;

uniform vec4 uColor;
uniform float uRadius;

#define CLAMPED_COLORS

void main ()
{
  vec2 p = vUv - uOrigin;
  vec4 dir = exp(-dot(p, p) / uRadius) * uColor;
  vec4 base = texture2D(uSource, vUv);

#ifdef CLAMPED_COLORS
  gl_FragColor = clamp(base + dir, 0.0, 1.0);
#else
  gl_FragColor = base + dir;
#endif
}
