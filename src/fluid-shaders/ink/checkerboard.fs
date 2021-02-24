precision highp float;
precision highp sampler2D;

varying vec2 vUv;
uniform float uAspectRatio;

#define SCALE 32.0

void main ()
{
	vec2 uv = floor(vUv * SCALE * vec2(uAspectRatio, 1.0));
	float v = mod(uv.x + uv.y, 2.0);

	gl_FragColor = vec4(v, v, v, 1.0);
}
