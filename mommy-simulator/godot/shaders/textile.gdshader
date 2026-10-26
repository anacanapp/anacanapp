shader_type spatial;
render_mode cull_back;
uniform vec4 colour : source_color = vec4(0.38, 0.49, 0.40, 1.0);
uniform sampler2D weave_normal : hint_normal;
uniform float bump = 0.0;
void vertex() { VERTEX += NORMAL * COLOR.a * bump; }
void fragment() {
	ALBEDO = colour.rgb;
	NORMAL_MAP = texture(weave_normal, UV * 8.0).rgb;
	NORMAL_MAP_DEPTH = 0.24;
	ROUGHNESS = 0.92;
}
