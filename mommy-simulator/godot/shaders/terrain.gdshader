shader_type spatial;
render_mode cull_disabled;
uniform sampler2D rock_albedo : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D rock_normal : hint_normal, filter_linear_mipmap, repeat_enable;
varying vec3 world;
varying vec3 world_normal;
void vertex() {
	world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	world_normal = normalize((MODEL_NORMAL_MATRIX * NORMAL));
}
void fragment() {
	vec3 weights = pow(abs(world_normal), vec3(4.0));
	weights /= max(0.001, weights.x + weights.y + weights.z);
	vec3 rock = texture(rock_albedo, world.yz * 0.08).rgb * weights.x
		+ texture(rock_albedo, world.xz * 0.08).rgb * weights.y
		+ texture(rock_albedo, world.xy * 0.08).rgb * weights.z;
	float tree_line = smoothstep(8.0, 26.0, world.y + sin(world.x * 0.23) * 2.0);
	vec3 ground = mix(vec3(0.17, 0.25, 0.15), rock * vec3(0.64, 0.69, 0.67), tree_line);
	float snow = smoothstep(35.0, 48.0, world.y + sin(world.x * 0.48 + world.z * 0.27) * 3.0);
	snow *= smoothstep(0.22, 0.60, world_normal.y);
	ALBEDO = mix(ground, vec3(0.83, 0.87, 0.87), snow);
	ROUGHNESS = 0.98;
}
