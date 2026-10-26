shader_type spatial;
render_mode cull_disabled;
uniform vec4 water_colour : source_color = vec4(0.10, 0.25, 0.28, 1.0);
uniform float wave_scale = 0.023;
varying vec3 world_position;

void vertex() {
	VERTEX.y += sin(VERTEX.x * 0.27 + TIME * 0.34) * 0.021 + cos(VERTEX.z * 0.31 + TIME * 0.27) * 0.018;
	world_position = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	float wave = sin(world_position.x * 1.73 + world_position.z * 0.28 + TIME * 0.55) * cos(world_position.z * 1.38 - TIME * 0.35);
	float fresnel = pow(1.0 - max(0.0, dot(NORMAL, VIEW)), 4.0);
	ALBEDO = mix(water_colour.rgb, vec3(0.29, 0.42, 0.47), fresnel * 0.65) + wave * 0.008;
	METALLIC = 0.0;
	ROUGHNESS = 0.13;
	SPECULAR = 0.75;
	NORMAL_MAP = normalize(vec3(sin(world_position.x * 2.2 + TIME * 0.4) * wave_scale, cos(world_position.z * 2.4 + TIME * 0.3) * wave_scale, 1.0)) * 0.5 + 0.5;
	NORMAL_MAP_DEPTH = 0.6;
}
