shader_type canvas_item;
uniform float intensity = 0.23;
void fragment() {
    vec2 p = UV * 2.0 - 1.0;
    float edges = smoothstep(0.23, 1.50, dot(p, p));
    COLOR = vec4(0.015, 0.027, 0.035, edges * intensity);
}
