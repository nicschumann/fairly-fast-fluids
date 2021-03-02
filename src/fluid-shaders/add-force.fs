precision highp float;
precision highp sampler2D;

varying vec2 vUv;

uniform sampler2D uSource;
uniform vec2 uTexelSize;
uniform vec2 uOrigin;
uniform vec2 uDirection;
uniform float uRadius;
uniform float uTheta;

mat2 rot(float angle)
{
  float c = cos(angle);
  float s = sin(angle);

  return mat2(
    vec2(c, -s),
    vec2(s,  c)
  );
}

void main ()
{
  vec2 d = rot(uTheta) * uDirection;
  vec2 p = vUv - uOrigin;
  vec2 dir = exp(-dot(p, p) / uRadius) * d;
  vec2 base = texture2D(uSource, vUv).xy;
  gl_FragColor = vec4(base + dir, 0.0, 1.0);
}
