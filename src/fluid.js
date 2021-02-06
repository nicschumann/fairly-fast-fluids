const regl = require('regl')({extensions: ['OES_texture_float', 'OES_texture_float_linear']});


// Texture Resolutions
const COLOR_RESOLUTION 	= 1024;
const SIM_RESOLUTION 		= 256;
const DELTA_T 					= 1.25;

const VELOCITY_DISSIPATION = 0.2;

const COLOR_TEXEL_SIZE	= 1.0 / COLOR_RESOLUTION;
const SIM_TEXEL_SIZE		= 1.0 / SIM_RESOLUTION;
const PRESSURE_JACOBI_ITERATIONS = 2;

function create_buffer(resolution)
{
	let color = regl.texture({
		data: new Float32Array(resolution * resolution * 4),
		shape: [resolution, resolution, 4],
		mag: 'linear',
		min: 'linear',
		wrapS: 'repeat',
		wrapT: 'repeat',
		type: 'float'
	});

	return regl.framebuffer({
		color,
		depth: false,
		stencil: false
	});
}

let color_0 = create_buffer(COLOR_RESOLUTION);
let color_1 = create_buffer(COLOR_RESOLUTION);

let velocity_0 = create_buffer(SIM_RESOLUTION);
let velocity_1 = create_buffer(SIM_RESOLUTION);

let pressure_0 = create_buffer(SIM_RESOLUTION);
let pressure_1 = create_buffer(SIM_RESOLUTION);

let divergence_0 = create_buffer(SIM_RESOLUTION);


const STANDARD_VERTEX_SOURCE = `
	precision highp float;

	attribute vec2 aPosition;

	varying vec2 vUv;
	varying vec2 vL;
	varying vec2 vR;
	varying vec2 vT;
	varying vec2 vB;

	uniform vec2 uTexelSize;

	void main ()
	{
		vUv = aPosition * 0.5 + 0.5;
		vL = vUv - vec2(uTexelSize.x, 0.0);
		vR = vUv + vec2(uTexelSize.x, 0.0);
		vT = vUv + vec2(0.0, uTexelSize.y);
		vB = vUv - vec2(0.0, uTexelSize.y);

		gl_Position = vec4(aPosition, 0.0, 1.0);
	}
`;

const create_color_buffer = regl({
	framebuffer: () => color_0,
	vert: STANDARD_VERTEX_SOURCE,
	frag: `
		precision highp float;
		precision highp sampler2D;

		varying vec2 vUv;
		uniform float uAspectRatio;

		#define SCALE 4.0

		void main ()
		{
			vec2 uv = floor(vUv * SCALE * vec2(uAspectRatio, 1.0));
			float v = mod(uv.x + uv.y, 2.0);

			// scale color
			// v = v * 0.1 + 0.8;

			gl_FragColor = vec4(v, 0.0, v, 1.0);
		}
	`,
	attributes: {
		aPosition: [-1, -1, -1, 1, 1, 1, 1, -1]
	},
	elements: [0, 1, 2, 0, 2, 3],
	uniforms: {
		uTexelSize: [COLOR_TEXEL_SIZE, COLOR_TEXEL_SIZE],
		uAspectRatio: 1.0
	},
	count: 6
});

const create_velocity_buffer = regl({
	framebuffer: () => velocity_0,
	vert: STANDARD_VERTEX_SOURCE,
	frag: `
		precision highp float;

		varying vec2 vUv;

		float x(vec2 v)
		{
			return sin(6.28318 * v.x);
		}

		float y(vec2 v)
		{
			return sin(6.28318 * v.y);
		}

		void main ()
		{
			float u = vUv.x * 2.0 - 1.0;
			float v = vUv.y * 2.0 - 1.0;

			float x = sin(2.0 * 3.1415 * v);
			float y = sin(2.0 * 3.1415 * u);

			gl_FragColor = vec4(
				x,
				y,
				0.0,
				1.0
			);
		}
	`,
	attributes: {
		aPosition: [-1, -1, -1, 1, 1, 1, 1, -1]
	},
	elements: [0, 1, 2, 0, 2, 3],
	uniforms: {
		uTexelSize: [SIM_TEXEL_SIZE, SIM_TEXEL_SIZE],
		uAspectRatio: 1.0
	},
	count: 6
});

const advect_buffer = regl({
	framebuffer: regl.prop('target'),
	vert: STANDARD_VERTEX_SOURCE,
	frag: `
		precision highp float;
		precision highp	sampler2D;

		varying vec2 vUv;

		uniform sampler2D uVelocity;
		uniform sampler2D uSource;
		uniform vec2 uVelocityTexelSize;
		uniform vec2 uTexelSize;
		uniform float dt;
		uniform float dissipation;

		vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
        vec2 st = uv / tsize - 0.5;
        vec2 iuv = floor(st);
        vec2 fuv = fract(st);
        vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
        vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
        vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
        vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);
        return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
    }

		void main()
		{
			vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * uVelocityTexelSize;
			vec4 result = texture2D(uSource, coord);
			float decay = 1.0 + dissipation * dt;

			gl_FragColor = result;
		}
	`,
	attributes: {
		aPosition: [-1, -1, -1, 1, 1, 1, 1, -1]
	},
	elements: [0, 1, 2, 0, 2, 3],
	uniforms: {
		uVelocity: regl.prop('velocity'),
		uSource: regl.prop('source'),
		uVelocityTexelSize: regl.prop('velocityTexSize'),
		uTexelSize: regl.prop('sourceTexSize'),
		dt: DELTA_T,
		dissipation: VELOCITY_DISSIPATION
	},
	count: 6
});


const calculate_divergence = regl({
	framebuffer: () => divergence_0,
	vert: STANDARD_VERTEX_SOURCE,
	frag: `
		precision mediump float;
		precision mediump sampler2D;

		varying highp vec2 vUv;
		varying highp vec2 vL;
		varying highp vec2 vR;
		varying highp vec2 vT;
		varying highp vec2 vB;

		uniform sampler2D uVelocity;

		void main ()
		{
			float L = texture2D(uVelocity, vL).x;
			float R = texture2D(uVelocity, vR).x;
			float T = texture2D(uVelocity, vT).y;
			float B = texture2D(uVelocity, vB).y;

			vec2 C = texture2D(uVelocity, vUv).xy;

			if (vL.x < 0.0) { L = -C.x; }
			if (vR.x > 1.0) { L = -C.x; }
			if (vT.y > 1.0) { L = -C.y; }
			if (vB.y < 0.0) { L = -C.y; }

			float div = 0.5 * (R - L + T - B);
			gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
		}
	`,
	attributes: {
		aPosition: [-1, -1, -1, 1, 1, 1, 1, -1]
	},
	elements: [0, 1, 2, 0, 2, 3],
	uniforms: {
		uVelocity: regl.prop('velocity'),
		uTexelSize: regl.prop('velocityTexSize'),
	},
	count: 6
});

const calculate_pressure = regl({
	framebuffer: regl.prop('target'),
	vert: STANDARD_VERTEX_SOURCE,
	frag: `
		precision mediump float;
		precision mediump sampler2D;

		varying highp vec2 vUv;
		varying highp vec2 vL;
		varying highp vec2 vR;
		varying highp vec2 vT;
		varying highp vec2 vB;

		uniform sampler2D uDivergence;
		uniform sampler2D uPressure;

		void main ()
		{
			float L = texture2D(uPressure, vL).x;
			float R = texture2D(uPressure, vR).x;
			float T = texture2D(uPressure, vT).x;
			float B = texture2D(uPressure, vB).x;

			float divergence = texture2D(uDivergence, vUv).x;
			float pressure = (L + R + B + T - divergence) * 0.25;

			gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
		}
	`,
	attributes: {
		aPosition: [-1, -1, -1, 1, 1, 1, 1, -1]
	},
	elements: [0, 1, 2, 0, 2, 3],
	uniforms: {
		uDivergence: regl.prop('divergence'),
		uPressure: regl.prop('pressure'),
		uTexelSize: regl.prop('pressureTexSize'),
	},
	count: 6
});

const calculate_velocity_gradient_for_pressure = regl({
	framebuffer: regl.prop('target'),
	vert: STANDARD_VERTEX_SOURCE,
	frag: `
		precision mediump float;
		precision mediump sampler2D;

		varying highp vec2 vUv;
		varying highp vec2 vL;
		varying highp vec2 vR;
		varying highp vec2 vT;
		varying highp vec2 vB;

		uniform sampler2D uVelocity;
		uniform sampler2D uPressure;

		void main ()
		{
			float L = texture2D(uPressure, vL).x;
			float R = texture2D(uPressure, vR).x;
			float T = texture2D(uPressure, vT).x;
			float B = texture2D(uPressure, vB).x;

			vec2 velocity = texture2D(uVelocity, vUv).xy;
			velocity.xy -= vec2(R - L, T - B);
			gl_FragColor = vec4(velocity, 0.0, 1.0);
		}
	`,
	attributes: {
		aPosition: [-1, -1, -1, 1, 1, 1, 1, -1]
	},
	elements: [0, 1, 2, 0, 2, 3],
	uniforms: {
		uVelocity: regl.prop('velocity'),
		uPressure: regl.prop('pressure'),
		uTexelSize: regl.prop('velocityTexSize'),
	},
	count: 6
});

const draw_buffer = regl({
	vert: STANDARD_VERTEX_SOURCE,
	frag: `
		precision highp float;
		precision highp	sampler2D;

		varying vec2 vUv;

		uniform sampler2D uSource;

		void main()
		{
			vec4 uv = texture2D(uSource, vUv);

			gl_FragColor = vec4(
				clamp(uv.x, 0.0, 1.0),
				clamp(uv.y, 0.0, 1.0),
				clamp(uv.z, 0.0, 1.0),
				1.0
			);
		}
	`,
	attributes: {
		aPosition: [-1, -1, -1, 1, 1, 1, 1, -1]
	},
	elements: [0, 1, 2, 0, 2, 3],
	uniforms: {
		uSource: () => color_0,
		uTexelSize: [COLOR_TEXEL_SIZE, COLOR_TEXEL_SIZE]
	},
	count: 6
})

let tmp;

create_color_buffer();
create_velocity_buffer();


regl.frame(() => {
	draw_buffer();

	advect_buffer({
		target: velocity_1,
		source: velocity_0,
		velocity: velocity_0,
		sourceTexSize: [SIM_TEXEL_SIZE, SIM_TEXEL_SIZE],
		velocityTexSize: [SIM_TEXEL_SIZE, SIM_TEXEL_SIZE]
	})

	calculate_divergence({
		velocity: velocity_1,
		velocityTexSize: [SIM_TEXEL_SIZE, SIM_TEXEL_SIZE],
	});

	for (var i = 0; i < PRESSURE_JACOBI_ITERATIONS; i++)
	{
		calculate_pressure({
			target: pressure_1,
			pressure: pressure_0,
			divergence: divergence_0,
			pressureTexSize: [SIM_TEXEL_SIZE, SIM_TEXEL_SIZE]
		});

		tmp = pressure_0;
		pressure_0 = pressure_1;
		pressure_1 = tmp;
	}


	calculate_velocity_gradient_for_pressure({
		target: velocity_0,
		pressure: pressure_1,
		velocity: velocity_1,
		velocityTexSize: [SIM_TEXEL_SIZE, SIM_TEXEL_SIZE]
	})

	advect_buffer({
		target: color_1,
		source: color_0,
		velocity: velocity_0,
		sourceTexSize: [COLOR_TEXEL_SIZE, COLOR_TEXEL_SIZE],
		velocityTexSize: [SIM_TEXEL_SIZE, SIM_TEXEL_SIZE]
	});


	tmp = color_0;
	color_0 = color_1;
	color_1 = tmp;

	tmp = pressure_0;
	pressure_0 = pressure_1;
	pressure_1 = tmp;
});
