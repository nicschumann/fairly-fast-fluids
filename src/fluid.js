const regl = require('regl')({extensions: ['OES_texture_float', 'OES_texture_float_linear']});


// Texture Resolutions
const COLOR_RESOLUTION = 512;
const SIM_RESOLUTION = 128;

// 0.25 is a good active time for the simulation.
// The velocity field doesn't blow up too quickly at this timestep.
// also with better boundary conditions this might not be an issue.
// NOTE: Check GPU Gems.
const DELTA_T = 0.25;

const VELOCITY_DISSIPATION = 0.2;
const VORTICITY = 1.0;
const CURL = 30;

const COLOR_TEXEL_SIZE = 1.0 / COLOR_RESOLUTION;
const SIM_TEXEL_SIZE = 1.0 / SIM_RESOLUTION;
const PRESSURE_JACOBI_ITERATIONS = 2;

const GRID_DIVISIONS = 30;

function create_arrow_geometry ()
{
	let positions = [];
	let elements = [];
	let uvs = [];

	let offsets = [[0, -0.005], [0.03, 0], [0, 0.005]]

	let division = 1 / GRID_DIVISIONS;
	for (var u = 0; u < GRID_DIVISIONS; u++)
	{
		for (var v = 0; v < GRID_DIVISIONS; v++)
		{
			let i = (u * GRID_DIVISIONS + v) * 3;
			let u_screen = 2.0 * division * u - 1.0 + division / 2.0;
			let v_screen = 2.0 * division * v - 1.0 + division / 2.0;

			uvs.push([u_screen, v_screen]);
			uvs.push([u_screen, v_screen]);
			uvs.push([u_screen, v_screen]);

			positions.push([u_screen + offsets[0][0], v_screen + offsets[0][1]])
			positions.push([u_screen + offsets[1][0], v_screen + offsets[1][1]])
			positions.push([u_screen + offsets[2][0], v_screen + offsets[2][1]])

			elements.push(i);
			elements.push(i + 1);
			elements.push(i + 2);
		}
	}

	return {
		positions,
		elements,
		uvs
	}
}

function create_buffer_from_image ()
{
	let im = document.getElementById('image');
	let color = regl.texture({
		data: im,
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

let arrows = create_arrow_geometry();

let tmp_color = create_buffer(COLOR_RESOLUTION);
let color_0 = create_buffer(COLOR_RESOLUTION);
// let color_0 = create_buffer_from_image();
let color_1 = create_buffer(COLOR_RESOLUTION);

let velocity_0 = create_buffer(SIM_RESOLUTION);
let velocity_1 = create_buffer(SIM_RESOLUTION);

let pressure_0 = create_buffer(SIM_RESOLUTION);
let pressure_1 = create_buffer(SIM_RESOLUTION);

let divergence_0 = create_buffer(SIM_RESOLUTION);
let curl_0 = create_buffer(SIM_RESOLUTION);


const create_color_buffer = regl({
	framebuffer: () => color_0,
	vert: require('./fluid-shaders/simple.vs'),
	frag: `
		precision highp float;
		precision highp sampler2D;

		varying vec2 vUv;
		uniform float uAspectRatio;

		#define SCALE 8.0

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

const draw_velocity_field = regl({
	framebuffer: regl.prop('target'),
	vert: `
		precision highp float;

		attribute vec2 aPosition;
		attribute vec2 aUV;

		uniform sampler2D uVelocity;

		mat2 rot(float angle)
		{
			float c = cos(angle);
			float s = sin(angle);

			return mat2(
				vec2(c, -s),
				vec2(s,  c)
			);
		}

		void main ()
		{
			vec2 sample = aUV * 0.5 + 0.5;
			vec2 v = texture2D(uVelocity, sample).xy;
			float angle = -atan(v.y, v.x);
			mat2 rotation = rot(angle);
			float scale = length(v);

			vec2 component = aPosition - aUV;
			component = scale * rotation * component;
			component = component + aUV;

			gl_Position = vec4(component, 0.0, 1.0);
		}
	`,
	frag: `
		precision highp float;

		void main ()
		{
			gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
		}
	`,
	attributes: {
		aPosition: arrows.positions,
		aUV: arrows.uvs
	},
	uniforms: {
		uVelocity: regl.prop('velocity')
	},
	count: arrows.positions.length,
});

const draw_pressure_field = regl({
	framebuffer: regl.prop('target'),
	vert: require('./fluid-shaders/simple.vs'),
	frag: require('./fluid-shaders/pressure/hsv-linear.fs'),
	attributes: {
		aPosition: [-1, -1, -1, 1, 1, 1, 1, -1]
	},
	elements: [0, 1, 2, 0, 2, 3],
	uniforms: {
		uPressure: regl.prop('pressure'),
		uTexelSize: [COLOR_TEXEL_SIZE, COLOR_TEXEL_SIZE],
	},
	count: 6

})

const clear_buffer = regl({
	framebuffer: regl.prop('target'),
	vert: require('./fluid-shaders/simple.vs'),
	frag: `
		precision mediump float;

		uniform vec4 uClearColor;

		void main ()
		{
			gl_FragColor = uClearColor;
		}
	`,
	attributes: {
		aPosition: [-1, -1, -1, 1, 1, 1, 1, -1]
	},
	elements: [0, 1, 2, 0, 2, 3],
	uniforms: {
		uTexelSize: [COLOR_TEXEL_SIZE, COLOR_TEXEL_SIZE],
		uClearColor: regl.prop('clearcolor')
	},
	count: 6
})

const create_velocity_buffer = regl({
	framebuffer: () => velocity_0,
	vert: require('./fluid-shaders/simple.vs'),
	frag: `
		precision highp float;

		varying vec2 vUv;

		void main ()
		{
			float u = vUv.x * 2.0 - 1.0;
			float v = vUv.y * 2.0 - 1.0;

			float x = sin(2.0 * 3.1415 * v);
			// float x = 1.0;
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
	vert: require('./fluid-shaders/simple.vs'),
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


const calculate_curl = regl({
	framebuffer: () => curl_0,
	vert: require('./fluid-shaders/simple.vs'),
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
			float L = texture2D(uVelocity, vL).y;
			float R = texture2D(uVelocity, vR).y;
			float T = texture2D(uVelocity, vT).x;
			float B = texture2D(uVelocity, vB).x;
			float vorticity = R - L - T + B;
			gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
		}
	`,
	attributes: {
		aPosition: [-1, -1, -1, 1, 1, 1, 1, -1]
	},
	elements: [0, 1, 2, 0, 2, 3],
	uniforms: {
		uVelocity: regl.prop('velocity'),
		uTexelSize: regl.prop('curlTexSize'),
	},
	count: 6
});

const calculate_vorticity = regl({
	framebuffer: regl.prop('target'),
	vert: require('./fluid-shaders/simple.vs'),
	frag: `
		precision highp float;
		precision highp sampler2D;

		varying vec2 vUv;
		varying vec2 vL;
		varying vec2 vR;
		varying vec2 vT;
		varying vec2 vB;

		uniform sampler2D uVelocity;
		uniform sampler2D uCurl;
		uniform float curl;
		uniform float dt;

		void main ()
		{
			float L = texture2D(uCurl, vL).y;
			float R = texture2D(uCurl, vR).y;
			float T = texture2D(uCurl, vT).x;
			float B = texture2D(uCurl, vB).x;
			float C = texture2D(uCurl, vUv).x;

			vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
			force /= length(force) + 0.0001;
			force *= curl * C;
			force.y *= -1.0;

			vec2 velocity = texture2D(uVelocity, vUv).xy;
			velocity += force * dt;
			velocity = min(max(velocity, -1000.0), 1000.0);
			gl_FragColor = vec4(velocity, 0.0, 1.0);
		}
	`,
	attributes: {
		aPosition: [-1, -1, -1, 1, 1, 1, 1, -1]
	},
	elements: [0, 1, 2, 0, 2, 3],
	uniforms: {
		uVelocity: regl.prop('velocity'),
		uCurl: regl.prop('curl'),
		uTexelSize: regl.prop('velocityTexSize'),
		vorticity: VORTICITY,
		curl: CURL,
		dt: DELTA_T,
	},
	count: 6
})


const calculate_divergence = regl({
	framebuffer: () => divergence_0,
	vert: require('./fluid-shaders/simple.vs'),
	frag: `
		precision mediump float;
		precision mediump sampler2D;

		varying highp vec2 vUv;
		varying highp vec2 vL;
		varying highp vec2 vR;
		varying highp vec2 vT;
		varying highp vec2 vB;

		uniform sampler2D uVelocity;
		uniform highp vec2 uTexelSize;
		uniform float rho;
		uniform float dt_inv;

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
		rho: 0.001,
		dt_inv: 1.0 / DELTA_T
	},
	count: 6
});

const calculate_pressure = regl({
	framebuffer: regl.prop('target'),
	vert: require('./fluid-shaders/simple.vs'),
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
	vert: require('./fluid-shaders/simple.vs'),
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
	framebuffer: regl.prop('target'),
	vert: require('./fluid-shaders/simple.vs'),
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
		uSource: regl.prop('source'),
		uTexelSize: [COLOR_TEXEL_SIZE, COLOR_TEXEL_SIZE]
	},
	count: 6
})

let tmp;
let keys = {};

create_color_buffer();
create_velocity_buffer();

regl.frame(() => {
	// clear_buffer({target: tmp_color, clearcolor: [1.0, 1.0, 1.0, 1.0]})

	// if ( !keys['s'] ) draw_buffer({source: color_0, target: tmp_color});
	//
	// // Show the velocity field arrows for debugging.
	// if ( keys['a'] ) { draw_velocity_field({velocity: velocity_0, target: tmp_color}); }
	// if ( keys['s'] ) { draw_pressure_field({pressure: pressure_0, target: tmp_color}); }

	draw_pressure_field({pressure: pressure_0, target: null});

	// draw_buffer({source: tmp_color, target: null});

	advect_buffer({
		target: velocity_1,
		source: velocity_0,
		velocity: velocity_0,
		sourceTexSize: [SIM_TEXEL_SIZE, SIM_TEXEL_SIZE],
		velocityTexSize: [SIM_TEXEL_SIZE, SIM_TEXEL_SIZE]
	});

	calculate_divergence({
		velocity: velocity_1,
		velocityTexSize: [SIM_TEXEL_SIZE, SIM_TEXEL_SIZE],
	});

	calculate_pressure({
		target: pressure_1,
		pressure: pressure_0,
		divergence: divergence_0,
		pressureTexSize: [SIM_TEXEL_SIZE, SIM_TEXEL_SIZE]
	});

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

	// tmp = velocity_0;
	// velocity_0 = velocity_1;
	// velocity_1 = tmp;
});



window.addEventListener('keydown', event => {
	keys[event.key] = true;
})

window.addEventListener('keyup', event => {
	keys[event.key] = false;
})
