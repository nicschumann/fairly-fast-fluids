precision highp float;

varying float vMagnitude;

void main ()
{
  gl_FragColor = vec4(vMagnitude / 50.0, 0.0, 0.0, 1.0);
}
