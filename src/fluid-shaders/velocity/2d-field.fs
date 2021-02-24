precision highp float;

varying vec2 vUv;

#define PI 3.1415

void main ()
{
  float u = vUv.x * 2.0 - 1.0;
  float v = vUv.y * 2.0 - 1.0;
  float alpha = 4.0;

  float x = sin(2.0 * PI * v);

  // float x = u * u;
  float y = sin(2.0 * PI * u);

  // this one is cool (v)
  // float y = exp(alpha * v);

  gl_FragColor = vec4(x, y, 0.0, 1.0);
}
