class_name MetroGameWidgets
extends RefCounted

class TimerDial extends Control:
	var font: Font
	var font_size := 34
	func _init() -> void:
		custom_minimum_size = Vector2(88, 88)
		mouse_filter = MOUSE_FILTER_IGNORE
	func _ready() -> void:
		font = load("res://assets/fonts/BarlowCondensed-SemiBold.ttf")
	func _process(_delta: float) -> void:
		queue_redraw()
	func _draw() -> void:
		var centre := size * 0.5
		var radius := minf(size.x, size.y) * 0.43
		var ratio := clampf(Metro.session.time_left / Metro.session.initial_time, 0, 1)
		var color := Color("ffac55") if Metro.session.time_left >= 2 else Color("ff6255")
		draw_circle(centre, radius + 4, Color(0.04, 0.085, 0.11, 0.86))
		draw_arc(centre, radius, -PI * 0.5, PI * 1.5, 60, Color(0.45, 0.53, 0.56, 0.28), 4, true)
		if ratio > 0: draw_arc(centre, radius, -PI * 0.5, -PI * 0.5 + TAU * ratio, 60, color, 4, true)
		var copy := "%.1f" % Metro.session.time_left
		var fs := int(radius * 0.93)
		var width := font.get_string_size(copy, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
		draw_string(font, centre + Vector2(-width / 2, fs * 0.29 - 3), copy, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, color)
		var small := "SANİYƏ"
		var small_fs := int(radius * 0.26)
		var small_width := font.get_string_size(small, HORIZONTAL_ALIGNMENT_LEFT, -1, small_fs).x
		draw_string(font, centre + Vector2(-small_width / 2, radius * 0.59), small, HORIZONTAL_ALIGNMENT_LEFT, -1, small_fs, Color("b6c2c5"))

class TapRing extends Control:
	var impulse := 0.0
	func _init() -> void:
		mouse_filter = MOUSE_FILTER_IGNORE
	func _process(delta: float) -> void:
		impulse = maxf(0, impulse - delta * 5)
		queue_redraw()
	func _draw() -> void:
		var centre := size * 0.5
		var radius := minf(size.x, size.y) * 0.45
		draw_circle(centre, radius + 7, Color(0.03, 0.08, 0.10, 0.50))
		draw_arc(centre, radius + 8, 0, TAU, 64, Color(1.0, 0.68, 0.28, 0.30 + impulse * 0.50), 2, true)
		for index in range(16):
			var angle := index * TAU / 16
			var direction := Vector2.from_angle(angle)
			draw_line(centre + direction * (radius + 11), centre + direction * (radius + 14 + impulse * 4), Color(1.0, 0.72, 0.38, 0.4), 1.4, true)

class DoorTrack extends Control:
	var font: Font
	func _init() -> void:
		custom_minimum_size = Vector2(160, 32)
		mouse_filter = MOUSE_FILTER_IGNORE
	func _ready() -> void:
		font = load("res://assets/fonts/BarlowCondensed-SemiBold.ttf")
	func _process(_delta: float) -> void:
		queue_redraw()
	func _draw() -> void:
		var count: int = Metro.session.doors_total
		for index in range(count):
			var centre := Vector2(18 + index * 38, size.y * 0.5)
			var done: bool = index < Metro.session.door_index or (index == Metro.session.door_index and Metro.session.mode == "won")
			var active: bool = index == Metro.session.door_index
			if index + 1 < count: draw_line(centre + Vector2(12, 0), centre + Vector2(29, 0), Color("485f65"), 2, true)
			draw_circle(centre, 12, Color("f0b060") if done else Color("17313c"))
			draw_arc(centre, 12, 0, TAU, 28, Color("f5ba70") if active or done else Color("526b72"), 1.5, true)
			var text := str(index + 1)
			var width := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, 14).x
			draw_string(font, centre + Vector2(-width / 2, 5), text, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color("17272c") if done else Color("e3e8e3"))
