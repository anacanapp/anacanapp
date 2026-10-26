shader_type spatial;
render_mode cull_disabled;
uniform vec4 colour : source_color = vec4(0.2, 0.3, 0.36, 1);
uniform sampler2D weave_normal : hint_normal;
void fragment() {
    ALBEDO = colour.rgb * (1.0 - COLOR.r * 0.28);
    NORMAL_MAP = texture(weave_normal, UV * 7.0).rgb;
    NORMAL_MAP_DEPTH = 0.22;
    ROUGHNESS = 0.89;
    SPECULAR = 0.18;
}
