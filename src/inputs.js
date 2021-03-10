var request = require('browser-request');
import * as R from './renderstates.js';

var event_buffer = [];
var mouse_buffer = [];
var keys = {};

export function handle_events(parameters, state, callback) {
	event_buffer.forEach(event => {
		if ( event.data == 'n' )
		{
			state.capture = true;
		}

		if ( ["A", "B", "C", "D", "E", "F", "G"].indexOf(event.data) !== -1)
		{
			request(`/src/data/${event.data}-forces.json`, (err, res) => {
				if (err) { return; }

				try {
					let glyph_data = JSON.parse(res.body);
					state.reset_forces = glyph_data.forces;
				} catch (err) {
					console.error(err);
				}
			});
		}

		if ( event.data == '0' )
		{
			state.render = R.RENDER_EDGES;
		}

		if ( event.data == '1' )
		{
			state.render = R.RENDER_COLOR;
		}

		if ( event.data == '2')
		{
			state.render = R.RENDER_VELOCITY;
		}

		if ( event.data == '3')
		{
			state.render = R.RENDER_PRESSURE;
		}

		if ( event.data == '4')
		{
			state.render = R.RENDER_COLOR_PICKER;
		}

		if ( event.data == '5' )
		{
			state.render = R.RENDER_RADIUS_PICKER;
		}

		if ( event.type == 'mouse' && !keys['Shift'])
		{
			if (state.render == R.RENDER_COLOR_PICKER)
			{
				state.reset_colors.push(event);
			}
			else if (state.render == R.RENDER_RADIUS_PICKER)
			{
				let radius = Math.sqrt(
					Math.pow(event.data.pos.x - 0.5, 2) +
					Math.pow(event.data.pos.y - 0.5, 2)
				) / 10;

				parameters.force.radius = radius;
				parameters.ink.radius = radius;
			}
			else
			{
				state.added_colors.push(event);
			}
		}

		if ( event.type == 'mouse' && keys['Shift'] && typeof event.data.dir !== 'undefined')
		{
			state.added_forces.push(event);
		}
	});

	event_buffer = [];
};


export function register_event_sources() {


	// Interactivity Inputs
	window.addEventListener('keydown', event => {
		keys[event.key] = true;
		event_buffer.push({type: 'key', data: event.key});
	});

	window.addEventListener('keyup', event => {
		keys[event.key] = false;
	});


	window.addEventListener('mousedown', event => {
		keys["mouse"] = true;

		// NOTE: ASPECT_RATIO
		let uAspectOffset = (window.innerWidth / (2.0 * window.innerHeight)) - 0.5;
		let mouse = {
			x: event.clientX / window.innerHeight - uAspectOffset,
			// x: event.clientX / window.innerWidth,
			y: 1.0 - (event.clientY / window.innerHeight)
		}

		if (keys['Shift']) { mouse_buffer.push(mouse); }
		event_buffer.push({type: 'mouse', data: {pos: mouse}})
	});


	window.addEventListener('mousemove', event => {


		// NOTE: ASPECT_RATIO
		// yes, dividing x by innerHeight is correct. This is an aspect ratio
		// correction, an algebraic simplification from
		// {x: (e.clientX / window.innerWidth) * (window.innerWidth / window.innerHeight), ...}
		let uAspectOffset = (window.innerWidth / (2.0 * window.innerHeight)) - 0.5
		let mouse = {
			x: event.clientX / window.innerHeight - uAspectOffset,
			// x: event.clientX / window.innerWidth,
			y: 1.0 - (event.clientY / window.innerHeight)
		};

		if (keys['mouse'] && keys['Shift']) {
			if (mouse_buffer.length > 0)
			{
				let prev_mouse = mouse_buffer[mouse_buffer.length - 1];

				let dmouse = {
					x: mouse.x - prev_mouse.x,
					y: mouse.y - prev_mouse.y
				};

				let l = Math.sqrt(dmouse.x * dmouse.x + dmouse.y * dmouse.y);

				dmouse.x /= l;
				dmouse.y /= l;

				mouse_buffer.push(mouse);
				if (dmouse.x === dmouse.x && dmouse.y === dmouse.y){
					event_buffer.push({type: 'mouse', data: {pos: mouse, dir: dmouse}})
				}
			}
		} else if (keys['mouse']) {
			event_buffer.push({type: 'mouse', data: {pos: mouse}})
		}
	})


	window.addEventListener('mouseup', event => {
		keys["mouse"] = false;
		mouse_buffer = [];
	});
}

export function keystate(key)
{
	return keys[key];
}
