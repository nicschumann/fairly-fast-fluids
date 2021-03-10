precision highp float;
precision highp sampler2D;

varying vec2 vUv;

uniform sampler2D uPressure;

// defines the sharpness of the
// spike at 0.0 for the green channel
#define EASING 0.05
#define EPSILON 0.0001

void main ()
{
  float x = texture2D(uPressure, vUv).x;
  float sigmoid = abs(1.0 / (1.0 + exp(-x * 4.0)) - 0.5) * 2.0;
  gl_FragColor = vec4(vec3(sigmoid), 1.0);
}
