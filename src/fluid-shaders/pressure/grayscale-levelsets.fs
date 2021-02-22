precision highp float;
precision highp sampler2D;

varying vec2 vUv;

uniform sampler2D uPressure;

void main ()
{
  float p = texture2D(uPressure, vUv).x;

  if ( p > 2.0 )
  {
    gl_FragColor = vec4(0.5, 0.5, 0.5, 1.0);
  }
  else if (p < -2.0)
  {
    gl_FragColor = vec4(0.5, 0.5, 0.5, 1.0);

  }
  else if (abs(p) < 0.01)
  {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  }
  else
  {
    gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
  }
}
