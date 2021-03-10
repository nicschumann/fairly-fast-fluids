precision highp float;
precision highp	sampler2D;

varying vec2 vUv;

uniform sampler2D uSource;
uniform vec2 uTexelSize;

#define THRESHOLD 1.6
#define CLAMPED_COLORS

void main()
{
  vec4 uv = texture2D(uSource, vUv);

#ifndef CLAMPED_COLORS
  uv = clamp(uv, 0.0, 1.0);
#endif

  if (length(uv) > THRESHOLD)
  {
    gl_FragColor = vec4(1.0);
  }
  else
  {
    gl_FragColor = vec4(vec3(0.0), 1.0);
  }
}
