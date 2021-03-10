precision highp float;
precision highp	sampler2D;

varying vec2 vUv;

uniform sampler2D uSource;
uniform vec2 uTexelSize;

// #define THRESHOLD 1.6
// // #define CLAMPED_COLORS
//
// void main()
// {
//   vec4 uv = texture2D(uSource, vUv);
//
// #ifndef CLAMPED_COLORS
//   uv = clamp(uv, 0.0, 1.0);
// #endif
//
//   if (length(uv) > THRESHOLD)
//   {
//     gl_FragColor = vec4(1.0);
//   }
//   else
//   {
//     gl_FragColor = vec4(vec3(0.0), 1.0);
//   }
// }

void main ()
{
  vec4 n[9];
  float dx = uTexelSize.x;
  float dy = uTexelSize.y;

  n[0] = texture2D(uSource, vUv + vec2( -dx, -dy ));
  n[1] = texture2D(uSource, vUv + vec2( 0.0, -dy ));
  n[2] = texture2D(uSource, vUv + vec2(  dx, -dy ));
  n[3] = texture2D(uSource, vUv + vec2( -dx, 0.0 ));
  n[4] = texture2D(uSource, vUv);
  n[5] = texture2D(uSource, vUv + vec2(  dx, 0.0 ));
  n[6] = texture2D(uSource, vUv + vec2( -dx, dy ));
  n[7] = texture2D(uSource, vUv + vec2( 0.0, dy ));
  n[8] = texture2D(uSource, vUv + vec2(  dx, dy ));

  vec4 sobel_edge_h = n[2] + (2.0 * n[5]) + n[8] - (n[0] + (2.0 * n[3]) + n[6]);
  vec4 sobel_edge_v = n[0] + (2.0 * n[1]) + n[2] - (n[6] + (2.0 * n[7]) + n[8]);
  vec4 sobel = sqrt((sobel_edge_h * sobel_edge_h) + (sobel_edge_v * sobel_edge_v));

  vec4 deriv = clamp(vec4(1.0 - sobel.rgb, 1.0), 0.0, 1.0);
  gl_FragColor = deriv;
}
