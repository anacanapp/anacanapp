shader_type spatial;
render_mode cull_disabled;
uniform sampler2D leaf_texture : source_color;
uniform vec4 leaf_colour : source_color = vec4(0.31, 0.42, 0.23, 1.0);
varying float variation;
void vertex() {
	variation = INSTANCE_CUSTOM.r;
	vec3 world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	VERTEX.x += sin(TIME * 0.9 + world.x * 0.31 + world.z * 0.23) * 0.018 * (1.0 - UV.y);
}
void fragment() {
	vec4 leaf = texture(leaf_texture, UV);
	if (leaf.a < 0.6) { discard; }
	ALBEDO = leaf.rgb * leaf_colour.rgb * (0.84 + variation * 0.32);
	ROUGHNESS = 0.94;
	BACKLIGHT = vec3(0.10, 0.13, 0.06);
}
