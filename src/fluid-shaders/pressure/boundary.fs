precision highp float;
precision highp sampler2D;

varying vec2 vUv;

uniform sampler2D uPressure;

#define RANGE 0.1

float norm_range(float t, float a, float b)
{
  return t / (b - a);
}

void main ()
{
  float p = texture2D(uPressure, vUv).x;

  if (abs(p) < 0.01)
  {
    gl_FragColor = vec4(1.0);
  }
  else
  {
    gl_FragColor = vec4(vec3(0.0), 1.0);
  }
}
