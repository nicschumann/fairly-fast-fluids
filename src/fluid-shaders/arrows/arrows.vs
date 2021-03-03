precision highp float;

attribute vec2 aPosition;
attribute vec2 aUV;

varying float vMagnitude;

uniform sampler2D uVelocity;
uniform float uAspectRatio;

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
  vec2 s = aUV * 0.5 + 0.5;
  s.x *= uAspectRatio;
  s.x -= uAspectRatio / 2.0 - 0.5;

  vec2 v = texture2D(uVelocity, s).xy;
  float angle = -atan(v.y, v.x);
  mat2 rotation = rot(angle);
  float scale = length(v);

  vec2 component = aPosition - aUV;
  component = min(scale, 2.0) * rotation * component;
  component = component + aUV;

  vMagnitude = scale;
  gl_Position = vec4(component, 0.0, 1.0);
}
