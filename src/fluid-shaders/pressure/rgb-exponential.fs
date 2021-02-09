precision highp float;
precision highp sampler2D;

varying vec2 vUv;

uniform sampler2D uPressure;

// defines the sharpness of the
// spike at 0.0 for the green channel
#define EASING 0.05
#define EPSILON 0.0001

// the red channel represents high values in the pressure field.
float r(float p)
{
  // float p_r = clamp(p, 0.0, 1.0);
  // return clamp(EASING / (p_r - 0.5 + EPSILON), 0.0, 1.0) - (2.0 * EASING);
  return clamp(exp(4.0 * (p - 1.0)), 0.0, 1.0);
}

// the green channel represents 0s in the pressure field.
float g(float p)
{
  return clamp(EASING / (p + EPSILON), 0.0, 1.0) - (2.0 * EASING);
}

// the blue channel represents low values in the pressure field.
float b(float p)
{
  return clamp(exp(4.0 * (-p - 1.0)), 0.0, 1.0);
}

void main ()
{
  float p = texture2D(uPressure, vUv).x;
  gl_FragColor = vec4(r(p), g(p), b(p), 1.0);
}
