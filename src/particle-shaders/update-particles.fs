precision mediump float;

uniform sampler2D curr_state;
uniform sampler2D prev_state;

varying vec2 texture_index;

float rand(vec2 co)
{
  return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43795.5453);
}

void main()
{
  vec2 curr_pos = texture2D(curr_state, texture_index).xy;
  vec2 prev_pos = texture2D(prev_state, texture_index).xy;

  vec2 velocity = curr_pos - prev_pos;
  vec2 random = 0.5 - vec2(rand(curr_pos), rand(10.0 * curr_pos));
  vec2 origin_force = -0.0001 * normalize(curr_pos);

  vec2 position = curr_pos + ((0.95 * velocity) + (0.0005 * random) + 0.005 * origin_force);

  gl_FragColor = vec4(position, 0, 1);
}
