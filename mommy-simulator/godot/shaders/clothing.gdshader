shader_type spatial;
render_mode cull_back;

uniform vec4 skin_colour : source_color = vec4(0.96, 0.79, 0.68, 1.0);
uniform vec4 shirt_colour : source_color = vec4(0.46, 0.59, 0.49, 1.0);
uniform vec4 trouser_colour : source_color = vec4(0.29, 0.35, 0.40, 1.0);
uniform sampler2D body_normal : hint_normal;
uniform float bump = 0.0;

void vertex() {
	VERTEX += NORMAL * COLOR.a * bump;
	VERTEX += NORMAL * (COLOR.r + COLOR.g) * 0.008;
}

void fragment() {
	float shirt = COLOR.r;
	float trousers = COLOR.g;
	ALBEDO = skin_colour.rgb * COLOR.b + shirt_colour.rgb * shirt + trouser_colour.rgb * trousers;
	float weave = sin(UV.x * 2800.0) * sin(UV.y * 2200.0) * 0.022;
	ALBEDO *= 1.0 + weave * (shirt + trousers);
	ROUGHNESS = 0.64 + (shirt + trousers) * 0.28;
	NORMAL_MAP = texture(body_normal, UV).rgb;
	NORMAL_MAP_DEPTH = 0.65 - (shirt + trousers) * 0.37;
}
