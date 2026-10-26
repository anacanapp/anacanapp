shader_type spatial;
render_mode cull_back;

uniform vec4 skin_colour : source_color = vec4(0.78, 0.54, 0.41, 1.0);
uniform vec4 shirt_colour : source_color = vec4(0.25, 0.37, 0.43, 1.0);
uniform vec4 trouser_colour : source_color = vec4(0.12, 0.17, 0.2, 1.0);
uniform sampler2D body_normal : hint_normal;
uniform sampler2D fabric_normal : hint_normal;
uniform vec4 shoe_colour : source_color = vec4(0.11, 0.15, 0.18, 1.0);
varying float body_height;

void vertex() {
    body_height = VERTEX.y;
}

void fragment() {
    float clothing = clamp(COLOR.r + COLOR.g, 0.0, 1.0);
    float face_detail = sin(UV.x * 35.0) * cos(UV.y * 52.0) * 0.018;
    ALBEDO = skin_colour.rgb * COLOR.b * (1.0 + face_detail) + shirt_colour.rgb * COLOR.r + trouser_colour.rgb * COLOR.g;
    ALBEDO = mix(ALBEDO, shoe_colour.rgb, 1.0 - smoothstep(0.11, 0.15, body_height));
    ROUGHNESS = mix(0.56, 0.88, clothing);
    SPECULAR = mix(0.38, 0.16, clothing);
    NORMAL_MAP = mix(texture(body_normal, UV).rgb, texture(fabric_normal, UV * 7.0).rgb, clothing * 0.45);
    NORMAL_MAP_DEPTH = mix(0.48, 0.16, clothing);
}
