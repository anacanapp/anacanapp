class_name MetroMapDiagram
extends Control

var route_id := "green"
var compact := false
var font: Font

func _init(id: String = "green", small: bool = false) -> void:
	route_id = id
	compact = small
	custom_minimum_size = Vector2(240, 330 if small else 250)
	mouse_filter = MOUSE_FILTER_IGNORE

func _ready() -> void:
	font = get_theme_default_font()
	queue_redraw()

func _draw() -> void:
	var route := Metro.route_by_id(route_id)
	var stations: Array = route.stations
	var columns := mini(stations.size(), 3 if compact else 6)
	var rows := int(ceil(float(stations.size()) / columns))
	var margin_x := 28.0 if compact else 48.0
	var gap_x := (size.x - margin_x * 2) / maxf(1, columns - 1)
	var gap_y := (size.y - 82) / maxf(1, rows - 1)
	var points: Array = []
	var line_color := Color(route.color)
	for index in range(stations.size()):
		var row := int(index / float(columns))
		var column := index % columns
		if row % 2 == 1: column = columns - 1 - column
		points.append(Vector2(margin_x + column * gap_x, 24 + row * gap_y))
	for index in range(points.size() - 1):
		draw_line(points[index], points[index + 1], Color("354644"), 5, true)
		if index < int(Metro.profile.route_progress[route_id]):
			draw_line(points[index], points[index + 1], line_color.darkened(0.08), 5, true)
	for index in range(points.size()):
		var point: Vector2 = points[index]
		var station := Metro.station_by_id(stations[index])
		var done: bool = Metro.profile.station_results.has(route_id + ":" + station.id)
		var open: bool = index <= int(Metro.profile.route_progress[route_id])
		if index == int(Metro.profile.route_progress[route_id]):
			draw_circle(point, 13, Color(line_color, 0.12))
		draw_circle(point, 8, line_color if open else Color("4a5c59"))
		draw_circle(point, 4, MetroStyle.PANEL if not done else line_color.lightened(0.1))
		var text: String = station.short
		var fs := 10 if compact else 11
		var width := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
		if width > gap_x - 6:
			while font.get_string_size(text + "…", HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x > gap_x - 6 and text.length() > 3:
				text = text.left(text.length() - 1)
			text += "…"
			width = font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
		draw_string(font, point + Vector2(-width / 2, 25), text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, MetroStyle.TEXT if open else MetroStyle.MUTED)
	var labels := ["keçilib", "növbəti", "kilidli"]
	for index in range(3):
		var x := 13.0 + index * size.x / 3.1
		var point := Vector2(x, size.y - 13)
		draw_circle(point, 4, line_color if index < 2 else Color("4a5c59"))
		if index == 1: draw_circle(point, 2, MetroStyle.PANEL)
		draw_string(font, point + Vector2(9, 4), labels[index], HORIZONTAL_ALIGNMENT_LEFT, -1, 10, MetroStyle.MUTED)
