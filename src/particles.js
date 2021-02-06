const sqrt_particles_count = 32;
const particles_count = sqrt_particles_count * sqrt_particles_count;


const regl = require('regl')({extensions: 'OES_texture_float'});

// random initial state for the particles
function initialize_particles ()
{
	const initial_state = new Float32Array(particles_count * 4);
	for (let i = 0; i < particles_count; i++)
	{
		// initial x position stored in texture
		// range is between -1 and 1 in clip space.
		initial_state[i * 4] = 2 * Math.random() - 1;
		// initial y position stored in texture
		// range is between -1 and 1 in clip space.
		initial_state[i * 4 + 1] = 2 * Math.random() - 1;
	}

	return initial_state;
}

function initialize_framebuffer(initial_state)
{
	const initial_texture = regl.texture({
		data: initial_state,
		shape: [sqrt_particles_count, sqrt_particles_count, 4],
		type: 'float'
	});

	return regl.framebuffer({
		// initialize the color buffer using
		// the texture we generated.
		color: initial_texture,
		// and turn off the depth and stencil buffers
		depth: false,
		stencil: false
	});
}

function initialize_texture_indices()
{
	const texture_indices = [];
	for (let i = 0; i < sqrt_particles_count; i++) {
		for (let j = 0; j < sqrt_particles_count; j++) {
			texture_indices.push(i / sqrt_particles_count, j / sqrt_particles_count);
		}
	}
	return texture_indices;
}

let initial_particles = initialize_particles();
let previous_state = initialize_framebuffer(initial_particles);
let current_state = initialize_framebuffer(initial_particles);
let next_state = initialize_framebuffer(initial_particles);
let particle_texture_indices = initialize_texture_indices();

// this function updates positions in the next frame buffer,
// given the current framebuffer and previous framebuffers,
// it does not do any drawing.
const update_particles = regl({
	framebuffer: () => next_state,
	vert: require('./particle-shaders/update-particles.vs'),
	frag: require('./particle-shaders/update-particles.fs'),
	attributes: {
		position: [-4, 0, 4, 4, 4, -4]
	},
	uniforms: {
		curr_state: () => current_state,
		prev_state: () => previous_state
	},
	count: 3
});

const draw_particles = regl({
	vert: require('./particle-shaders/draw-particles.vs'),
	frag: require('./particle-shaders/draw-particles.fs'),
	attributes: {
		texture_index: particle_texture_indices
	},
	uniforms: {
		particle_state: () => current_state,
		point_width: 5
	},
	count: particles_count,
	primitive: 'points',
	depth: {
		enable: false,
		mask: false
	}
});

regl.frame(() => {
	regl.clear({
		color: [0, 0, 0, 1],
		depth: 1
	});

	draw_particles();

	update_particles();

	let tmp = previous_state;
	previous_state = current_state;
	current_state = next_state;
	next_state = tmp;
});
