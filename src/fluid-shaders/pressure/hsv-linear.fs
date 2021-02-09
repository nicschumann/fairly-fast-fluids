precision highp float;
precision highp sampler2D;

varying vec2 vUv;

uniform sampler2D uPressure;

// This shader works well at timesteps around 0.25.
// It's a little less interesting for

// the offset controls where the HSV scale starts.
#define OFFSET 0.5

// this is due to http://lolengine.net/blog/2013/07/27/rgb-to-hsv-in-glsl
vec3 hsv2rgb(vec3 c)
{
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main ()
{
  float p = texture2D(uPressure, vUv).x;
  vec3 p_hsv = vec3(p, 1.0, p);
  gl_FragColor = vec4(hsv2rgb(p_hsv), 1.0);
}
