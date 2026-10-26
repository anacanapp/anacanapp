class_name MetroWardrobe
extends Control

var clock := 0.0
var minimal := false

func _init(compact: bool = false) -> void:
	minimal = compact
	custom_minimum_size = Vector2(100, 175) if compact else Vector2(240, 285)
	mouse_filter = MOUSE_FILTER_IGNORE

func _process(delta: float) -> void:
	if not Metro.profile.settings.get("reduced_motion", false): clock += delta
	queue_redraw()

func _draw() -> void:
	var center := Vector2(size.x / 2, size.y * 0.86)
	var factor := minf(size.y / 175.0, size.x / 125.0)
	if not minimal:
		draw_circle(Vector2(size.x / 2, size.y * 0.46), minf(size.x * 0.37, size.y * 0.4), Color("1c322b"))
		draw_arc(Vector2(size.x / 2, size.y * 0.46), minf(size.x * 0.37, size.y * 0.4), 0, TAU, 60, Color("354b39"), 1, true)
		for index in range(4):
			var point := Vector2(size.x * (0.16 + index * 0.22), size.y * 0.9)
			draw_circle(point, 2, MetroStyle.LIME.darkened(0.5))
	MetroCharacter.draw_person(self, center, factor, -1, false, Metro.profile.equipped, sin(clock) * 0.2, float(Metro.player_stats().size))
