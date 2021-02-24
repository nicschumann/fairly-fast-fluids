precision highp float;
precision highp sampler2D;

varying vec2 vUv;
uniform float uAspectRatio;

void main ()
{
  if (vUv.y > 0.8 || vUv.y < 0.2)
  {
    gl_FragColor = vec4(vec3(1.0), 1.0);
  }
  else
  {
    gl_FragColor = vec4(vec3(0.0), 1.0);
  }
}
