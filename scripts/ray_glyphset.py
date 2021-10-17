#MenuTitle: PsychSim: Make Glyphset File
# -*- coding: utf-8 -*-
__doc__="""
Part of the PyschSim Suite. This script generates a character set map file
for the PsychSim. the character set map file maps from decimal unicodes to
internal glyph names, and is used for looking up glyph forces from the UI.
"""

target_file_path = "/Users/nic/Desktop/charset.js"
charset_structure = "export const charset = {\n"
ordered_charset_structure = "export const ordered_charset = [\n"

for glyph in Glyphs.font.glyphs:
	if glyph.unicode:
		name = glyph.name if glyph.name == glyph.name.lower() else glyph.name + '_'
		data = (int(glyph.unicode, 16), name)
		charset_structure += '\t"%s": "%s", \n' % data
		ordered_charset_structure += '\t["%s", "%s"],\n' % data

charset_structure += "};\n\n"
ordered_charset_structure += "];"

file_data = charset_structure + ordered_charset_structure

with open(target_file_path, 'w') as file:
	file.write(file_data)
