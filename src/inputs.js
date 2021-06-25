var request = require('browser-request');
import * as R from './renderstates.js';
import {charset, ordered_charset} from './ampersand-charset.js';


var event_buffer = [];
var mouse_buffer = [];
var keys = {};


export function DOM_render_charset(id)
{
  let parent = document.getElementById(id);

  if (parent != null)
  {
    ordered_charset.forEach(data => {
      let code = data[0];
      let glyphname = data[1];

      let character = String.fromCharCode(+code)

      let span = document.createElement('span');
      span.classList.add('key');
      span.classList.add('action-trigger');
      span.classList.add('glyphset');
			span.classList.add(`key-${code}`);

			// the default active glyph pattern...
			if (glyphname == 'A_')
			{
				span.classList.add('active');
			}
			else
			{
				span.classList.add('untouched');
			}

      span.innerText = character;

      span.setAttribute('id', `key-${code}`);
      span.setAttribute('data-glyph-name', glyphname);
			span.setAttribute('data-code', code);

      parent.appendChild(span);
    });
  }
}

function DOM_set_active_in_set(id, selector)
{
	let elements = document.querySelectorAll(`.${selector}.active`);
	Array.from(elements).forEach(el => el.classList.remove('active'));
	let targets = document.querySelectorAll(id);
	targets.forEach(element => {
		element.classList.add('active');
		element.classList.remove('untouched');
	});
}

function DOM_toggle_class_by_id(id, cls, state)
{
	let element = document.getElementById(id);
	if (element != null) {
		if (typeof state === 'undefined')
		{
			element.classList.toggle(cls);
		}
		else
		{
			element.classList.toggle(cls, state);
		}
	}
}


var actions = {
	'Escape': (parameters, state) => {
		// uncomment below if you want the Esc reminder to show up on the screen.
		// if (state.interacting) { DOM_toggle_class_by_id('overlay-escape', 'overlay-hidden') }
		DOM_toggle_class_by_id('overlay-top', 'overlay-hidden');
		DOM_toggle_class_by_id('overlay-center', 'overlay-hidden', true);
		state.interacting = true;
	},

	'n': (parameters, state) => {
		state.capture = true;
	},

	'0': (parameters, state) => {
		state.toggle_recording = true;
	},

	'1': (parameters, state) => {
		if (state.interacting)
		{
			state.render = R.RENDER_COLOR;
			DOM_set_active_in_set('.key-1', 'renderstate');
		}
	},

	'2': (parameters, state) => {
		if (state.interacting)
		{
			state.render = R.RENDER_VELOCITY;
			DOM_set_active_in_set('.key-2', 'renderstate');
		}
	},

	'3': (parameters, state) => {
		if (state.interacting)
		{
			state.render = R.RENDER_EMITTER_FIELD;
			DOM_set_active_in_set('.key-6', 'renderstate');
		}
	},

	'4': (parameters, state) => {
		if (state.interacting)
		{
			state.render = R.RENDER_COLOR_PICKER;
			DOM_set_active_in_set('.key-4', 'renderstate');
		}
	},

	'5': (parameters, state) => {
		if (state.interacting)
		{
			state.render = R.RENDER_RADIUS_PICKER;
			DOM_set_active_in_set('.key-5', 'renderstate');
		}
	},

	'6': (parameters, state) => {
		if (state.interacting)
		{
			state.render = R.RENDER_PRESSURE;
			DOM_set_active_in_set('.key-3', 'renderstate');
		}
	},

	'9': (parameters, state) => {
		state.added_colors.push({
			data: {pos: {x: 0.5, y: 0.5}}
		});
	}
};


export function handle_events(parameters, state) {
	event_buffer.forEach(event => {
		if (typeof actions[event.data] !== 'undefined')
		{
			actions[event.data](parameters, state);
		}

		else if (
			typeof charset[event.code] !== 'undefined' && state.interacting &&
			// if you're holding down multiple keys (like shift for cap-A),
			// we only want to process the cap-A event, not the shift event.
			String.fromCharCode(event.code) == event.data
		) {
			let glyphname = charset[event.code]
			request(`/src/data/ampersands/${glyphname}-forces.json`, (err, res) => {
				if (err) { return; }

				try {
					let glyph_data = JSON.parse(res.body);
					state.reset_forces = glyph_data.forces;
					DOM_set_active_in_set(`.key-${event.code}`, 'glyphset');
				} catch (err) {
					console.error(err);
				}
			});

		}

		else if (
			event.type == 'mouse' && !keys['Shift'] &&
			state.interacting
		) {
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

		else if (
			event.type == 'mouse' && keys['Shift'] &&
			typeof event.data.dir !== 'undefined' &&
			state.interacting
		) {
			state.added_forces.push(event);
		}
	});

	event_buffer = [];
};


export function register_event_sources() {
	// Interactivity Inputs
	window.addEventListener('keydown', event => {
		keys[event.key] = true;
		// console.log(event.key);
		event_buffer.push({type: 'key', code: `${event.key.charCodeAt(0)}`, data: event.key});
	});

	window.addEventListener('keyup', event => {
		keys[event.key] = false;
	});

	// probably make this a more robust selection?
	let canvas = document.querySelectorAll('canvas')[0];


	document.addEventListener('mousedown', event => {
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


	document.addEventListener('mousemove', event => {


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


	document.addEventListener('mouseup', event => {
			keys["mouse"] = false;
			mouse_buffer = [];
		});

	document.querySelectorAll('.action-trigger').forEach(element => {
		// comment these to allow button clicking to draw.

		element.addEventListener('mousedown', event => {
			event.stopPropagation();
		});

		element.addEventListener('click', event => {
			// create proxy events
			let data_action = element.getAttribute('data-action');
			let data_code = element.getAttribute('data-code');

			if (data_action)
			{
				console.log(`found action: ${data_action}`);
				event_buffer.push({type: 'key', data: data_action});
			}

			if (data_code)
			{
				console.log(`found code: ${data_code}`);
				event_buffer.push({type: 'key', code: data_code, data: String.fromCharCode(data_code)});
			}
		});
	})
}

export function keystate(key)
{
	return keys[key];
}
