precision highp float;
precision highp sampler2D;

varying vec2 vUv;

uniform sampler2D uSource;
uniform vec2 uTexelSize;
uniform vec2 uOrigin;
uniform vec2 uDirection;
uniform float uRadius;

void main ()
{
  vec2 p = vUv - uOrigin;
  vec2 dir = exp(-dot(p, p) / uRadius) * uDirection;
  vec2 base = texture2D(uSource, vUv).xy;
  gl_FragColor = vec4(base + dir, 0.0, 1.0);
}
