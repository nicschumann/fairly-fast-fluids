var request = require('browser-request');
import * as R from './renderstates.js';
import {charset} from './charset.js';


var event_buffer = [];
var mouse_buffer = [];
var keys = {};


function DOM_set_active_in_set(id, selector)
{
	let elements = document.querySelectorAll(`.${selector}.active`);
	Array.from(elements).forEach(el => el.classList.remove('active'));
	let target = document.getElementById(id);
	if (target != null) {target.classList.add('active');}
}


var actions = {
	'n': (parameters, state) => {
		state.capture = true;
	},

	'1': (parameters, state) => {
		state.render = R.RENDER_COLOR;
		DOM_set_active_in_set('key-1', 'renderstate');
	},

	'2': (parameters, state) => {
		state.render = R.RENDER_VELOCITY;
		DOM_set_active_in_set('key-2', 'renderstate');
	},

	'3': (parameters, state) => {
		state.render = R.RENDER_PRESSURE;
		DOM_set_active_in_set('key-3', 'renderstate');
	},

	'4': (parameters, state) =>{
		state.render = R.RENDER_COLOR_PICKER;
		DOM_set_active_in_set('key-4', 'renderstate');
	},

	'5': (parameters, state) => {
		state.render = R.RENDER_RADIUS_PICKER;
		DOM_set_active_in_set('key-5', 'renderstate');
	}
};


export function handle_events(parameters, state) {
	event_buffer.forEach(event => {
		if (typeof actions[event.data] !== 'undefined')
		{
			actions[event.data](parameters, state);
		}

		else if (
			typeof charset[event.code] !== 'undefined' &&
			// if you're holding down multiple keys (like shift for cap-A),
			// we only want to process the cap-A event, not the shift event.
			String.fromCharCode(event.code) == event.data
		) {
			let glyphname = charset[event.code]
			request(`/src/data/glyphs/${glyphname}-forces.json`, (err, res) => {
				if (err) { return; }

				try {
					let glyph_data = JSON.parse(res.body);
					state.reset_forces = glyph_data.forces;
				} catch (err) {
					console.error(err);
				}
			});

		}

		else if ( event.type == 'mouse' && !keys['Shift'])
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

		else if ( event.type == 'mouse' && keys['Shift'] && typeof event.data.dir !== 'undefined')
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
		event_buffer.push({type: 'key', code: `${event.key.charCodeAt(0)}`, data: event.key});
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
