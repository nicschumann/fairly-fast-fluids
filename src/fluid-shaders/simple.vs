precision highp float;

attribute vec2 position;
varying vec2 v_pos;

vec2 getUVFromPosition(vec2 coord)
{
  return coord * 0.5 + 0.5;
}

void main ()
{
  v_pos = getUVFromPosition(position);
  gl_Position = vec4(position, 0.0, 1.0);
}
