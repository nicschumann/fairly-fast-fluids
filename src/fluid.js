const regl = require('regl')({
	// attributes: {preserveDrawingBuffer: true},
	extensions: ['OES_texture_float', 'OES_texture_float_linear', 'OES_standard_derivatives']});
const request = require('browser-request');
import {register_event_sources, handle_events, keystate} from './inputs.js';
import * as R from './renderstates.js';


/**
 * Hello, and welcome to this simulator that draws Psychedelic Letters
 * Using color, velocity, and pressure fields.
 *
 * This is the web component of a system that integrates with GlyphsApp.
 * Initial vector fields are generated directly from GlyphsApp as JSON descriptions.
 *
 * These JSON descriptions then act as initial conditions for a fluid simulation.
 *
 * The sim has many modes, which can be set by specifying different initial vector fields.
 *
 * Velocity Mode:
 * In Velocity mode, the sim pushes ink around a 2D surface according to these glyph vector fields,
 * creating a dynamic painting. For good effects with velocity mode, start with a vector field
 * composed of tangent vectors to the glyphs
 *
 */
// "Compile Time" Constants
// Texture Resolutions
const COLOR_RESOLUTION = 2048;
const SIM_RESOLUTION = 128;
const COLOR_TEXEL_SIZE = 1.0 / COLOR_RESOLUTION;
const SIM_TEXEL_SIZE = 1.0 / SIM_RESOLUTION;

// JSON Polling Interval (only relevant for development mode)
const CONFIG_POLLING_INTERVAL = 1000;
const PRESSURE_JACOBI_ITERATIONS = 50;
const VELOCITY_GRID_DIVISIONS = 65;

// Runtime parameters:
// Tweaking these changes the behavior of the simulation over its lifespan.

let parameters = {
	// dt: this is the length of the timestep for the simulation.
	// This is NOT the framerate of the simulation (which tries to stick to 60)
	// a range from 4 - 0.01 creates an
	// interesting range of effects here.
	dt: 0.025,

	// dt: 0.01 - 0.025, v.m: 1, v.theta: PI / 2 is a good combination for pressure images
	// dt: 0.25, v.m: 0.001, v.theta: PI is a good combination for ink images

	velocity: {
		// dissipation: 0.18,
		dissipation: 0.25,
		radius: 0.00025,
		magnitude: 1,
		theta: Math.PI / 2
	},

	pressure: {
		dissipation: 0.25,
		// --- v these might not be used v ---
		radius: 0.001,
		magnitude: 0.06
		// --- ^ these might not be used ^  ---
	},

	force: {
		radius: 0.001,
		magnitude: 0.1
	},

	ink: {
		radius: 0.001,
		color: [1.0, 1.0, 1.0, 1.0]
	}
};

// parameters = require('./data/01-velocity-parameters.json');

function create_arrow_geometry ()
{
	let positions = [];
	let elements = [];
	let uvs = [];

	let offsets = [[0, -0.005], [0.03, 0], [0, 0.005]]

	let division = 1 / VELOCITY_GRID_DIVISIONS;
	for (var u = 0; u < VELOCITY_GRID_DIVISIONS; u++)
	{
		for (var v = 0; v < VELOCITY_GRID_DIVISIONS; v++)
		{
			let i = (u * VELOCITY_GRID_DIVISIONS + v) * 3;
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

// function create_emitter_map(data, buffer)
// {
//
//
// 	return buffer;
// }

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

class DoubleFramebuffer {
  constructor(resolution) {
		this.tmp = null;
		this.front = create_buffer(resolution);
		this.back = create_buffer(resolution);
  }

  swap() {
    this.tmp = this.front;
		this.front = this.back;
		this.back = this.tmp;
  }
}

// Application Memory

let arrows = create_arrow_geometry();

let color_buffer = new DoubleFramebuffer(COLOR_RESOLUTION);
let velocity_buffer = new DoubleFramebuffer(SIM_RESOLUTION);
let pressure_buffer = new DoubleFramebuffer(SIM_RESOLUTION);
let velocity_emitter_buffer = new DoubleFramebuffer(SIM_RESOLUTION);
let divergence_buffer = create_buffer(SIM_RESOLUTION);
let color_picker_buffer = create_buffer(COLOR_RESOLUTION);


// OpenGL Shader Programs

const create_color_buffer = regl({
	framebuffer: regl.prop('target'),
	vert: require('./fluid-shaders/simple.vs'),
	frag: require('./fluid-shaders/ink/half-tone.fs'),
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
	vert: require('./fluid-shaders/arrows/arrows.vs'),
	frag: require('./fluid-shaders/arrows/arrows.fs'),
	attributes: {
		aPosition: arrows.positions,
		aUV: arrows.uvs
	},
	uniforms: {
		uVelocity: regl.prop('velocity'),
		uAspectRatio: () => window.innerWidth / window.innerHeight
	},
	count: arrows.positions.length,
});


const draw_pressure_field = regl({
	framebuffer: regl.prop('target'),
	vert: require('./fluid-shaders/simple.vs'),
	frag: require('./fluid-shaders/pressure/boundary.fs'),
	attributes: {
		aPosition: [-1, -1, -1, 1, 1, 1, 1, -1]
	},
	elements: [0, 1, 2, 0, 2, 3],
	uniforms: {
		uPressure: regl.prop('pressure'),
		uTexelSize: [COLOR_TEXEL_SIZE, COLOR_TEXEL_SIZE],
		uAspectRatio: () => window.innerWidth / window.innerHeight
	},
	count: 6
});


const clear_buffer = regl({
	framebuffer: regl.prop('target'),
	vert: require('./fluid-shaders/simple.vs'),
	frag: require('./fluid-shaders/clear.fs'),
	attributes: {
		aPosition: [-1, -1, -1, 1, 1, 1, 1, -1]
	},
	elements: [0, 1, 2, 0, 2, 3],
	uniforms: {
		uTexelSize: [COLOR_TEXEL_SIZE, COLOR_TEXEL_SIZE],
		uClearColor: regl.prop('clearcolor'),
		uAspectRatio: 1.0
	},
	count: 6
});


const create_velocity_buffer = regl({
	framebuffer: regl.prop('target'),
	vert: require('./fluid-shaders/simple.vs'),
	frag: require('./fluid-shaders/velocity/2d-field.fs'),
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

const add_color = regl({
	framebuffer: regl.prop('target'),
	vert: require('./fluid-shaders/simple.vs'),
	frag: require('./fluid-shaders/add-color.fs'),
	attributes: {
		aPosition: [-1, -1, -1, 1, 1, 1, 1, -1]
	},
	elements: [0, 1, 2, 0, 2, 3],
	uniforms: {
		uSource: regl.prop('source'),
		uTexelSize: regl.prop('sourceTexSize'),
		uOrigin: regl.prop('origin'),
		uColor: regl.prop('color'),
		uRadius: regl.prop('radius'),
		uAspectRatio: 1.0
	},
	count: 6
})

const add_directed_force = regl({
	framebuffer: regl.prop('target'),
	vert: require('./fluid-shaders/simple.vs'),
	frag: require('./fluid-shaders/add-force.fs'),
	attributes: {
		aPosition: [-1, -1, -1, 1, 1, 1, 1, -1]
	},
	elements: [0, 1, 2, 0, 2, 3],
	uniforms: {
		uSource: regl.prop('source'),
		uTexelSize: regl.prop('sourceTexSize'),
		uOrigin: regl.prop('origin'),
		uDirection: regl.prop('direction'),
		uRadius: regl.prop('radius'),
		uTheta: regl.prop('theta'),
		uAspectRatio: 1.0
	},
	count: 6
});

const add_emitter_field = regl({
	framebuffer: regl.prop('target'),
	vert: require('./fluid-shaders/simple.vs'),
	frag: `
		precision mediump float;
		precision mediump sampler2D;

		varying vec2 vUv;

		uniform sampler2D uEmitters;
		uniform sampler2D uVelocity;

		void main ()
		{
			vec4 vel = texture2D(uVelocity, vUv);
			vec4 em = texture2D(uEmitters, vUv);

			gl_FragColor = vel + em;
		}
	`,
	attributes: {
		aPosition: [-1, -1, -1, 1, 1, 1, 1, -1]
	},
	elements: [0, 1, 2, 0, 2, 3],
	uniforms: {
		uEmitters: regl.prop('emitters'),
		uVelocity: regl.prop('velocity'),
		uTexelSize: regl.prop('sourceTexSize'),
		uAspectRatio: 1.0
	},
	count: 6
})

const advect_buffer = regl({
	framebuffer: regl.prop('target'),
	vert: require('./fluid-shaders/simple.vs'),
	frag: require('./fluid-shaders/advect.fs'),
	attributes: {
		aPosition: [-1, -1, -1, 1, 1, 1, 1, -1]
	},
	elements: [0, 1, 2, 0, 2, 3],
	uniforms: {
		uVelocity: regl.prop('velocity'),
		uSource: regl.prop('source'),
		uVelocityTexelSize: regl.prop('velocityTexSize'),
		uTexelSize: regl.prop('sourceTexSize'),
		dt: regl.prop('dt'),
		dissipation: regl.prop('dissipation'),
		uIsColor: regl.prop('iscolor'),
		uAspectRatio: 1.0
	},
	count: 6
});

// Not currently used

// const calculate_curl = regl({
// 	framebuffer: regl.prop('target'),
// 	vert: require('./fluid-shaders/simple.vs'),
// 	frag: require('./fluid-shaders/curl.fs'),
// 	attributes: {
// 		aPosition: [-1, -1, -1, 1, 1, 1, 1, -1]
// 	},
// 	elements: [0, 1, 2, 0, 2, 3],
// 	uniforms: {
// 		uVelocity: regl.prop('velocity'),
// 		uTexelSize: regl.prop('curlTexSize'),
// 	},
// 	count: 6
// });
//
// const calculate_vorticity = regl({
// 	framebuffer: regl.prop('target'),
// 	vert: require('./fluid-shaders/simple.vs'),
// 	frag: require('./fluid-shaders/vorticity.fs'),
// 	attributes: {
// 		aPosition: [-1, -1, -1, 1, 1, 1, 1, -1]
// 	},
// 	elements: [0, 1, 2, 0, 2, 3],
// 	uniforms: {
// 		uVelocity: regl.prop('velocity'),
// 		uCurl: regl.prop('curl'),
// 		uTexelSize: regl.prop('velocityTexSize'),
// 		vorticity: regl.prop('vorticity'),
// 		curl: regl.prop('curlrate'),
// 		dt: parameters.dt,
// 	},
// 	count: 6
// })


const calculate_divergence = regl({
	framebuffer: regl.prop('target'),
	vert: require('./fluid-shaders/simple.vs'),
	frag: require('./fluid-shaders/divergence.fs'),
	attributes: {
		aPosition: [-1, -1, -1, 1, 1, 1, 1, -1]
	},
	elements: [0, 1, 2, 0, 2, 3],
	uniforms: {
		uVelocity: regl.prop('velocity'),
		uTexelSize: regl.prop('velocityTexSize'),
		uAspectRatio: 1.0
	},
	count: 6
});

const calculate_pressure = regl({
	framebuffer: regl.prop('target'),
	vert: require('./fluid-shaders/simple.vs'),
	frag: require('./fluid-shaders/pressure-iteration.fs'),
	attributes: {
		aPosition: [-1, -1, -1, 1, 1, 1, 1, -1]
	},
	elements: [0, 1, 2, 0, 2, 3],
	uniforms: {
		uDivergence: regl.prop('divergence'),
		uPressure: regl.prop('pressure'),
		uTexelSize: regl.prop('pressureTexSize'),
		dissipation: regl.prop('dissipation'),
		dt: regl.prop('dt'),
		uAspectRatio: 1.0
	},
	count: 6
});

const calculate_velocity_gradient_for_pressure = regl({
	framebuffer: regl.prop('target'),
	vert: require('./fluid-shaders/simple.vs'),
	frag: require('./fluid-shaders/gradient.fs'),
	attributes: {
		aPosition: [-1, -1, -1, 1, 1, 1, 1, -1]
	},
	elements: [0, 1, 2, 0, 2, 3],
	uniforms: {
		uVelocity: regl.prop('velocity'),
		uPressure: regl.prop('pressure'),
		uTexelSize: regl.prop('velocityTexSize'),
		uAspectRatio: 1.0
	},
	count: 6
});

const draw_buffer = regl({
	framebuffer: regl.prop('target'),
	vert: require('./fluid-shaders/simple.vs'),
	frag: require('./fluid-shaders/draw-buffer.fs'),
	attributes: {
		aPosition: [-1, -1, -1, 1, 1, 1, 1, -1]
	},
	elements: [0, 1, 2, 0, 2, 3],
	uniforms: {
		uSource: regl.prop('source'),
		uTexelSize: [COLOR_TEXEL_SIZE, COLOR_TEXEL_SIZE],
		// ASPECT_RATIO
		uAspectRatio: () => window.innerWidth / window.innerHeight
	},
	count: 6
})

const draw_edges = regl({
	framebuffer: regl.prop('target'),
	vert: require('./fluid-shaders/simple.vs'),
	frag: require('./fluid-shaders/draw-regions.fs'),
	attributes: {
		aPosition: [-1, -1, -1, 1, 1, 1, 1, -1]
	},
	elements: [0, 1, 2, 0, 2, 3],
	uniforms: {
		uSource: regl.prop('source'),
		uTexelSize: [COLOR_TEXEL_SIZE, COLOR_TEXEL_SIZE],
		// ASPECT_RATIO
		uAspectRatio: () => window.innerWidth / window.innerHeight
	},
	count: 6
})

const draw_radius_picker = regl({
	framebuffer: regl.prop('target'),
	vert: require('./fluid-shaders/simple.vs'),
	frag: `
		precision highp float;

		varying vec2 vUv;

		uniform float uRadius;

		#define EPSILON 0.001

		void main ()
		{
			float r = length(vUv - vec2(0.5, 0.5));

			if (abs(r - uRadius) < EPSILON)
			{
				gl_FragColor = vec4(1.0);
			}
			else
			{
				gl_FragColor = vec4(vec3(0.0), 1.0);
			}
		}
	`,
	attributes: {
		aPosition: [-1, -1, -1, 1, 1, 1, 1, -1]
	},
	elements: [0, 1, 2, 0, 2, 3],
	uniforms: {
		uRadius: regl.prop('radius'),
		uMouseRadius: regl.prop('mouseradius'),
		uTexelSize: [COLOR_TEXEL_SIZE, COLOR_TEXEL_SIZE],
		// ASPECT_RATIO
		uAspectRatio: () => window.innerWidth / window.innerHeight
	},
	count: 6
})

const draw_color_picker = regl({
	framebuffer: regl.prop('target'),
	vert: require('./fluid-shaders/simple.vs'),
	frag: `
		precision highp float;

		varying vec2 vUv;

		// this is due to http://lolengine.net/blog/2013/07/27/rgb-to-hsv-in-glsl
		vec3 hsv2rgb(vec3 c)
		{
		    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
		    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
		    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
		}

		#define SIZE .25
		#define TWOPI 6.28318

		void main ()
		{
			vec2 radius = vUv - vec2(0.5, 0.5);
			float theta = atan(radius.y, radius.x);
			float mag = length(radius);

			if (mag <= SIZE)
			{
				gl_FragColor = vec4(hsv2rgb(vec3(theta / TWOPI, mag / .25, 1.0)), 1.0);
			}
			else
			{
				gl_FragColor = vec4(vec3(0.0), 1.0);
			}
		}
	`,
	attributes: {
		aPosition: [-1, -1, -1, 1, 1, 1, 1, -1]
	},
	elements: [0, 1, 2, 0, 2, 3],
	uniforms: {
		uTexelSize: [COLOR_TEXEL_SIZE, COLOR_TEXEL_SIZE],
		uAspectRatio: () => 1.0
	},
	count: 6
})

let data = require('./data/forces.json');

let state = {
	simulating: true,
	render: R.RENDER_COLOR,
	capture: false,

	added_colors: [],
	reset_colors: [],
	added_forces: [],
	reset_forces: [],
};

// create_color_buffer({target: color_buffer.front});
// create_velocity_buffer({target: velocity_buffer.front});
draw_color_picker({target: color_picker_buffer});
clear_buffer({target: color_buffer.front, clearcolor: [0.0, 0.0, 0.0, 1.0]})
clear_buffer({target: velocity_buffer.front, clearcolor: [0.0, 0.0, 0.0, 1.0]});

register_event_sources();


// create the initial emitter map
// this depicts persistant emitters that generate
// velocity for all time. The initial emitters
// are constructed from the tangent or normal fields
// to a chosen glyph.
data.forces.forEach(force => {
	// directions are given in unit magnitude, which
	// is way to big for clip space. Scale it down.
	let dir = force.dir.map(x => x * parameters.velocity.magnitude);

	add_directed_force({
		target: velocity_emitter_buffer.back,
		source: velocity_emitter_buffer.front,
		sourceTexSize: [SIM_TEXEL_SIZE, SIM_TEXEL_SIZE],
		origin: force.pos,
		direction: dir,
		theta: parameters.velocity.theta,
		radius: parameters.velocity.radius
	});

	velocity_emitter_buffer.swap();
});

console.log(parameters);

// simulation

regl.frame(() => {

	handle_events(parameters, state);

	if (state.render == R.RENDER_EDGES) draw_edges({source: color_buffer.front, target: null});
	if (state.render == R.RENDER_COLOR &&  keystate(' ')) draw_edges({source: color_buffer.front, target: null});
	if (state.render == R.RENDER_COLOR && !keystate(' ')) draw_buffer({source: color_buffer.front, target: null});
	if (state.render == R.RENDER_VELOCITY) draw_velocity_field({velocity: velocity_buffer.front, target: null});
	if (state.render == R.RENDER_PRESSURE) draw_pressure_field({pressure: pressure_buffer.front, target: null});
	if (state.render == R.RENDER_COLOR_PICKER) draw_buffer({source: color_picker_buffer, target: null});
	if (state.render == R.RENDER_RADIUS_PICKER) draw_radius_picker({radius: parameters.force.radius * 10, target: null});

	// save the canvas data if required

	if (state.capture)
	{
		let a = document.createElement('a');
		let canvas = document.getElementsByTagName('canvas')[0];
		let data = canvas.toDataURL('image/png');

		console.log('downloading image');

		a.setAttribute('download', 'canvas-image.png');
		a.setAttribute('href', data);
		a.click();

		state.capture = false;
	}


	// add_directed_force
	state.added_forces.forEach(event => {
		add_directed_force({
			target: velocity_buffer.back,
			source: velocity_buffer.front,
			sourceTexSize: [SIM_TEXEL_SIZE, SIM_TEXEL_SIZE],
			origin: [event.data.pos.x, event.data.pos.y],
			direction: [
				event.data.dir.x * parameters.force.magnitude,
				event.data.dir.y * parameters.force.magnitude
			],
			theta: 0.0,
			radius: parameters.force.radius
		});

		velocity_buffer.swap();
	});

	state.added_forces = [];


	// add_color
	state.added_colors.forEach(event => {
		add_color({
			target: color_buffer.back,
			source: color_buffer.front,
			sourceTexSize: [COLOR_TEXEL_SIZE, COLOR_TEXEL_SIZE],
			origin: [event.data.pos.x, event.data.pos.y],
			color: parameters.ink.color.map(x => (keystate('Meta') ? -x : x)),
			radius: parameters.ink.radius
		});

		color_buffer.swap();
	});

	state.added_colors = [];

	// reset_forces
	if (state.reset_forces.length > 0)
	{
		clear_buffer({target: velocity_emitter_buffer.front, clearcolor: [0.0, 0.0, 0.0, 1.0]});
	}

	state.reset_forces.forEach(force => {
		let dir = force.dir.map(x => x * parameters.velocity.magnitude);

		add_directed_force({
			target: velocity_emitter_buffer.back,
			source: velocity_emitter_buffer.front,
			sourceTexSize: [SIM_TEXEL_SIZE, SIM_TEXEL_SIZE],
			origin: force.pos,
			direction: dir,
			theta: parameters.velocity.theta,
			radius: parameters.velocity.radius
		});

		velocity_emitter_buffer.swap();
	});

	state.reset_forces = [];


	// reset_colors
	state.reset_colors.forEach(event => {
		color_picker_buffer.use(() => {
			parameters.ink.color = regl.read({
				x: event.data.pos.x * COLOR_RESOLUTION,
				y: event.data.pos.y * COLOR_RESOLUTION,
				width: 1,
				height: 1
			});
		});
	});


	// external forces
	if (state.simulating)
	{
		add_emitter_field({
			target: velocity_buffer.back,
			emitters: velocity_emitter_buffer.front,
			velocity: velocity_buffer.front,
			sourceTexSize: [SIM_TEXEL_SIZE, SIM_TEXEL_SIZE]
		});
		velocity_buffer.swap();
	}


	if (state.simulating)
	{
		advect_buffer({
			target: velocity_buffer.back,
			source: velocity_buffer.front,
			velocity: velocity_buffer.front,
			sourceTexSize: [SIM_TEXEL_SIZE, SIM_TEXEL_SIZE],
			velocityTexSize: [SIM_TEXEL_SIZE, SIM_TEXEL_SIZE],
			dissipation: parameters.velocity.dissipation,
			dt: parameters.dt,
			iscolor: false
		});

		calculate_divergence({
			target: divergence_buffer,
			velocity: velocity_buffer.back,
			velocityTexSize: [SIM_TEXEL_SIZE, SIM_TEXEL_SIZE],
		});

		// create_arrow_geometry initializing pressure from scratch each cycle
		// note: it doesn't really work that well, and costs more.

		if (PRESSURE_JACOBI_ITERATIONS > 0)
		{
			clear_buffer({
				target: pressure_buffer.front,
				clearcolor: [0.0, 0.0, 0.0, 1.0]
			});

			for (var i = 0; i < PRESSURE_JACOBI_ITERATIONS; i += 1)
			{
				calculate_pressure({
					target: pressure_buffer.back,
					pressure: pressure_buffer.front,
					divergence: divergence_buffer,
					pressureTexSize: [SIM_TEXEL_SIZE, SIM_TEXEL_SIZE],
					dissipation: parameters.pressure.dissipation,
					dt: parameters.dt
				});

				pressure_buffer.swap();
			}
		}
		else
		{
			calculate_pressure({
				target: pressure_buffer.back,
				pressure: pressure_buffer.front,
				divergence: divergence_buffer,
				pressureTexSize: [SIM_TEXEL_SIZE, SIM_TEXEL_SIZE],
				dissipation: parameters.pressure.dissipation,
				dt: parameters.dt
			});

			pressure_buffer.swap();
		}

		calculate_velocity_gradient_for_pressure({
			target: velocity_buffer.front,
			pressure: pressure_buffer.front,
			velocity: velocity_buffer.back,
			velocityTexSize: [SIM_TEXEL_SIZE, SIM_TEXEL_SIZE]
		});

		advect_buffer({
			target: color_buffer.back,
			source: color_buffer.front,
			velocity: velocity_buffer.front,
			sourceTexSize: [COLOR_TEXEL_SIZE, COLOR_TEXEL_SIZE],
			velocityTexSize: [SIM_TEXEL_SIZE, SIM_TEXEL_SIZE],
			dissipation: parameters.velocity.dissipation,
			dt: parameters.dt,
			iscolor: true
		});

		color_buffer.swap()
	}
});
