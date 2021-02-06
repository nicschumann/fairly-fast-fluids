precision mediump float;

attribute vec2 position;

varying vec2 texture_index;

void main()
{
  texture_index = 0.5 * (1.0 + position);
  gl_Position = vec4(position, 0, 1);
}
