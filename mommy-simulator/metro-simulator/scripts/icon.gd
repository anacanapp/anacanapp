class_name MetroIcon
extends Control

var kind := "metro"
var tint := MetroStyle.LIME

func _init(icon_kind: String = "metro", color: Color = MetroStyle.LIME, icon_size: float = 24.0) -> void:
	kind = icon_kind
	tint = color
	custom_minimum_size = Vector2(icon_size, icon_size)
	mouse_filter = MOUSE_FILTER_IGNORE

func _draw() -> void:
	var factor := minf(size.x, size.y) / 32.0
	draw_set_transform(Vector2((size.x - 32 * factor) / 2, (size.y - 32 * factor) / 2), 0, Vector2.ONE * factor)
	match kind:
		"metro":
			_line([Vector2(4, 25), Vector2(4, 8), Vector2(9, 8), Vector2(16, 18), Vector2(23, 8), Vector2(28, 8), Vector2(28, 25)], 3)
			_line([Vector2(5, 29), Vector2(27, 29)], 2)
		"play":
			draw_colored_polygon(PackedVector2Array([Vector2(10, 5), Vector2(27, 16), Vector2(10, 27)]), tint)
		"map":
			_line([Vector2(4, 6), Vector2(12, 3), Vector2(20, 7), Vector2(28, 4), Vector2(28, 25), Vector2(20, 29), Vector2(12, 25), Vector2(4, 28), Vector2(4, 6)])
			_line([Vector2(12, 3), Vector2(12, 25)])
			_line([Vector2(20, 7), Vector2(20, 29)])
		"shop":
			_line([Vector2(6, 10), Vector2(26, 10), Vector2(28, 28), Vector2(4, 28), Vector2(6, 10)])
			draw_arc(Vector2(16, 10), 6, PI, TAU, 18, tint, 2, true)
		"person":
			draw_arc(Vector2(16, 10), 6, 0, TAU, 20, tint, 2, true)
			draw_arc(Vector2(16, 28), 11, PI, TAU, 20, tint, 2, true)
		"settings":
			draw_arc(Vector2(16, 16), 10, 0, TAU, 24, tint, 2, true)
			draw_arc(Vector2(16, 16), 4, 0, TAU, 18, tint, 2, true)
			for angle in range(8):
				var direction := Vector2.from_angle(angle * PI / 4)
				draw_line(Vector2(16, 16) + direction * 10, Vector2(16, 16) + direction * 14, tint, 3, true)
		"coin":
			draw_circle(Vector2(16, 16), 13, tint)
			draw_arc(Vector2(16, 16), 9, 0, TAU, 32, tint.darkened(0.32), 1.5, true)
			draw_line(Vector2(16, 9), Vector2(16, 23), tint.darkened(0.65), 3, true)
		"speed", "energy":
			draw_colored_polygon(PackedVector2Array([Vector2(19, 2), Vector2(7, 18), Vector2(15, 18), Vector2(12, 30), Vector2(26, 12), Vector2(18, 12)]), tint)
		"power", "gloves":
			_line([Vector2(4, 22), Vector2(8, 22), Vector2(10, 8), Vector2(16, 7), Vector2(18, 12), Vector2(16, 15), Vector2(22, 16), Vector2(27, 21), Vector2(25, 27), Vector2(8, 27), Vector2(4, 22)], 2.5)
		"time", "watch":
			draw_arc(Vector2(16, 17), 11, 0, TAU, 30, tint, 2, true)
			_line([Vector2(16, 10), Vector2(16, 17), Vector2(22, 20)], 2.5)
			_line([Vector2(12, 2), Vector2(20, 2)], 2.5)
		"shoe":
			_line([Vector2(3, 19), Vector2(7, 7), Vector2(14, 8), Vector2(18, 18), Vector2(27, 20), Vector2(29, 25), Vector2(3, 25), Vector2(3, 19)], 2.5)
			_line([Vector2(13, 14), Vector2(18, 13)])
			_line([Vector2(14, 18), Vector2(20, 17)])
		"helmet":
			draw_arc(Vector2(16, 21), 12, PI, TAU, 24, tint, 3, true)
			_line([Vector2(2, 22), Vector2(30, 22)], 3)
			_line([Vector2(16, 6), Vector2(16, 16)], 3)
		"jacket":
			_line([Vector2(11, 4), Vector2(21, 4), Vector2(29, 11), Vector2(25, 18), Vector2(22, 15), Vector2(23, 29), Vector2(9, 29), Vector2(10, 15), Vector2(7, 18), Vector2(3, 11), Vector2(11, 4)], 2)
			_line([Vector2(16, 6), Vector2(16, 28)])
		"headphones":
			draw_arc(Vector2(16, 16), 12, PI, TAU, 28, tint, 2.5, true)
			_rect(Rect2(2, 15, 6, 12), tint, 3)
			_rect(Rect2(24, 15, 6, 12), tint, 3)
		"backpack":
			_rect(Rect2(6, 9, 20, 21), tint, 5)
			draw_arc(Vector2(16, 9), 5, PI, TAU, 18, tint, 2, true)
			draw_rect(Rect2(10, 20, 12, 7), tint.darkened(0.4), false, 1.5)
		"cup", "medal":
			_line([Vector2(8, 4), Vector2(24, 4), Vector2(23, 15), Vector2(19, 21), Vector2(13, 21), Vector2(9, 15), Vector2(8, 4)])
			_line([Vector2(16, 21), Vector2(16, 28), Vector2(23, 28), Vector2(9, 28)], 2.5)
			draw_arc(Vector2(25, 9), 5, -PI / 2, PI / 2, 16, tint, 2, true)
			draw_arc(Vector2(7, 9), 5, PI / 2, PI * 1.5, 16, tint, 2, true)
		"sound":
			_line([Vector2(4, 12), Vector2(10, 12), Vector2(18, 5), Vector2(18, 27), Vector2(10, 20), Vector2(4, 20), Vector2(4, 12)])
			draw_arc(Vector2(19, 16), 8, -1.0, 1.0, 14, tint, 2, true)
			draw_arc(Vector2(19, 16), 13, -1.0, 1.0, 14, tint, 2, true)
		"pause":
			_rect(Rect2(8, 6, 5, 20), tint, 1)
			_rect(Rect2(19, 6, 5, 20), tint, 1)
		"lock":
			_rect(Rect2(6, 14, 20, 15), tint, 4)
			draw_arc(Vector2(16, 14), 7, PI, TAU, 20, tint, 2, true)
		"check":
			_line([Vector2(6, 16), Vector2(13, 23), Vector2(27, 8)], 3)
		"arrow":
			_line([Vector2(5, 16), Vector2(27, 16), Vector2(20, 9), Vector2(27, 16), Vector2(20, 23)], 2.5)
		"tap":
			_line([Vector2(12, 25), Vector2(7, 16), Vector2(11, 14), Vector2(15, 19), Vector2(15, 5), Vector2(19, 5), Vector2(19, 14), Vector2(27, 16), Vector2(25, 27), Vector2(16, 29), Vector2(12, 25)], 2)
			for index in range(3):
				var angle := -PI * 0.95 + index * 0.7
				var direction := Vector2.from_angle(angle)
				draw_line(Vector2(17, 5) + direction * 7, Vector2(17, 5) + direction * 11, tint, 2, true)
		_:
			draw_arc(Vector2(16, 16), 12, 0, TAU, 24, tint, 2, true)
	draw_set_transform(Vector2.ZERO)

func _line(points: Array, width: float = 2.0) -> void:
	draw_polyline(PackedVector2Array(points), tint, width, true)

func _rect(rect: Rect2, color: Color, radius: int) -> void:
	draw_style_box(MetroStyle.box(color, radius, color, 0), rect)
