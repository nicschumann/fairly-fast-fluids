precision highp float;

varying vec2 v_pos;

uniform sampler2D curr_advection_field;
uniform sampler2D curr_velocity_field;

uniform vec2 advection_texel_size;
uniform vec2 velocity_texel_size;

uniform float dt;

vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize)
{
  vec2 st = uv / tsize - 0.5;
  vec2 iuv = floor(st);
  vec2 fuv = fract(st);

  vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
  vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
  vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
  vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);

  return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
}

void main ()
{
  // vec2 u = texture2D(curr_velocity_field, v_pos).xy;
  // vec2 pastCoord = fract(v_pos - (0.5 * dt * u * velocity_texel_size));
  // gl_FragColor = texture2D(curr_advection_field, pastCoord);



  vec2 coord = fract(v_pos - bilerp(curr_velocity_field, v_pos, velocity_texel_size).xy * dt * 0.5);
  vec4 color = bilerp(curr_advection_field, coord, advection_texel_size);
  gl_FragColor = color;
}
