precision mediump float;

attribute vec2 texture_index;

uniform sampler2D particle_state;

varying vec3 frag_color;

uniform float point_width;

void main()
{
  vec2 position = texture2D(particle_state, texture_index).xy;
  frag_color = vec3(abs(texture_index), 1.0);

  gl_Position = vec4(position, 0.0, 1.0);
  gl_PointSize = point_width;
}
