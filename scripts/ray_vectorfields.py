#MenuTitle: PsychSim: Make Vector Fields
# -*- coding: utf-8 -*-
__doc__="""
Part of the PyschSim Suite. This script generates a VectorField json files
which define glyph geometry in terms of tangent vectors to the glyph outlines.
These files are used as part of the Ray PsychSim program to embed letterforms
into the fluid sim.
"""
from GlyphsApp import *

from math import sqrt, ceil, sin, cos, pi
import json

# from library import draw_field


def isCubic(segment):
	return len(segment) == 4

def isLinear(segment):
	return len(segment) == 2

def getLinearPoint(t, segment):
	A = segment[0]
	B = segment[1]

	C1 = (
		B.x - A.x,
		B.y - A.y
	)

	C0 = (A.x, A.y)

	return (
		C1[0] * t + C0[0],
		C1[1] * t + C0[1]
	)

def getLinearTangent(t, segment):
	A = segment[0]
	B = segment[1]

	C1 = (
		B.x - A.x,
		B.y - A.y
	)

	C0 = (A.x, A.y)

	length = sqrt(C1[0] * C1[0] + C1[1] * C1[1])

	return (
		C1[0] / length,
		C1[1] / length
	)



def getCubicPoint(t, segment):
	A = segment[0]
	B = segment[1]
	C = segment[2]
	D = segment[3]

	C1 = (
		D.x - (3.0 * C.x) + (3.0 * B.x) - A.x,
		D.y - (3.0 * C.y) + (3.0 * B.y) - A.y,
	)

	C2 = (
		(3.0 * C.x) - (6.0 * B.x) + (3.0 * A.x),
		(3.0 * C.y) - (6.0 * B.y) + (3.0 * A.y)
	)

	C3 = (
		(3.0 * B.x) - (3.0 * A.x),
		(3.0 * B.y) - (3.0 * A.y),
	)

	C4 = A.x, A.y

	return (
		C1[0] * t * t * t + C2[0] * t * t + C3[0] * t + C4[0],
		C1[1] * t * t * t + C2[1] * t * t + C3[1] * t + C4[1]
	)

def getCubicTangent(t, segment):
	A = segment[0]
	B = segment[1]
	C = segment[2]
	D = segment[3]

	C1 = (
		D.x - (3.0 * C.x) + (3.0 * B.x) - A.x,
		D.y - (3.0 * C.y) + (3.0 * B.y) - A.y,
	)

	C2 = (
		(3.0 * C.x) - (6.0 * B.x) + (3.0 * A.x),
		(3.0 * C.y) - (6.0 * B.y) + (3.0 * A.y)
	)

	C3 = (
		(3.0 * B.x) - (3.0 * A.x),
		(3.0 * B.y) - (3.0 * A.y),
	)

	T = (
		(3.0 * C1[0] * t * t) + (2.0 * C2[0] * t) + C3[0],
		(3.0 * C1[1] * t * t) + (2.0 * C2[1] * t) + C3[1]
	)

	length = sqrt(T[0] * T[0] + T[1] * T[1])

	return (
		T[0] / length,
		T[1] / length
	)
#
samples_per_unit = 1.0 / 10.0
theta = 0.0
normalization_factor = 1.5
offset_x = 0.18
offset_y = 0.15

def draw_field(layer):
	width_offset = (1000.0 - layer.width) / 2000.0
	emitters = []
	for contour in layer.paths:
		for segment in contour.segments:
			# normalize by length (it's distance between endpoints, not arclength)
			length = sqrt((segment[-1].x - segment[0].x)**2 + (segment[-1].y - segment[0].y)**2)
			samples = (samples_per_unit * length)
			samples = int(ceil(samples))
			# print(samples)

			# sample length
			for s in range(samples):
				t = float(s) / samples
				point = getCubicPoint(t, segment) if isCubic(segment) else getLinearPoint(t, segment)
				tangent = getCubicTangent(t, segment) if isCubic(segment) else getLinearTangent(t, segment)

				normal_point = (
					point[0] / (normalization_factor*1000) + (normalization_factor * offset_x),
					point[1] / (normalization_factor*1000) + (normalization_factor * offset_x))

				matrix = [
					cos(theta), -sin(theta),
					sin(theta),  cos(theta)
				]

				normal_tangent = (
					tangent[0] * matrix[0] + tangent[1] * matrix[1],
					tangent[0] * matrix[2] + tangent[1] * matrix[3])

				normal_tangent_endpoint = (
					point[0] - 20 * normal_tangent[0],
					point[1] - 20 * normal_tangent[1])

				emitters.append({"pos": normal_point, "dir": normal_tangent, "radius": 0.001})

	if layer.parent.name != layer.parent.name.lower():
		filepath = "/Users/nic/Desktop/test/%s_-forces.json" % layer.parent.name
	else:
		filepath = "/Users/nic/Desktop/test/%s-forces.json" % layer.parent.name

	with open(filepath, 'w') as target_file:
		data = json.dumps({"forces": emitters}, indent=4)
		target_file.write(data)

selected_id = Glyphs.font.selectedFontMaster.id
layers = list(map(lambda g: list(filter(lambda l: l.associatedMasterId == selected_id, g.layers))[0], Glyphs.font.glyphs))

for layer in layers:
	if layer.parent.unicode:
		draw_field(layer)
