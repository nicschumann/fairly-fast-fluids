precision highp float;
precision highp	sampler2D;

varying vec2 vUv;

uniform sampler2D uSource;

void main()
{
  vec4 uv = texture2D(uSource, vUv);

  gl_FragColor = clamp(uv, 0.0, 1.0);
}
