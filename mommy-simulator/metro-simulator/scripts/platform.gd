class_name MetroPlatform
extends Control

var preview := true
var clock := 0.0
var door_open := 1.0
var train_offset := 0.0
var player_lane := 1.0
var player_progress := 0.0
var punch := 0.0
var flash := 0.0
var celebrate := 0.0
var particles: Array = []
var floating: Array = []
var last_mode := "idle"
var font: Font
var bold: Font

func _init(is_preview: bool = true) -> void:
	preview = is_preview
	custom_minimum_size = Vector2(250, 235)
	mouse_filter = MOUSE_FILTER_IGNORE
	clip_contents = true

func _ready() -> void:
	font = get_theme_default_font()
	bold = font

func event(entry: Dictionary) -> void:
	if entry.type == "tap":
		punch = 1.0
		if not Metro.profile.settings.reduced_motion:
			var origin := Vector2(0.5 + (Metro.session.lane - 1) * 0.13, 0.58 - Metro.session.progress() * 0.12)
			for index in range(4):
				particles.append({"pos": origin, "velocity": Vector2(randf_range(-0.15, 0.15), randf_range(-0.25, -0.08)), "life": 0.45, "color": MetroStyle.LIME, "size": randf_range(2, 4)})
	elif entry.type == "clear":
		flash = 0.35
		floating.append({"text": "+%.0f s" % entry.bonus if float(entry.bonus) > 0 else "YOL AÇILDI", "pos": Vector2(0.52, 0.48), "life": 1.1, "color": MetroStyle.ORANGE if float(entry.bonus) > 0 else MetroStyle.LIME})
	elif entry.type == "burst":
		flash = 1.0
	elif entry.type == "won":
		celebrate = 1.0
		if not Metro.profile.settings.reduced_motion:
			for index in range(40):
				particles.append({"pos": Vector2(randf_range(0.15, 0.85), randf_range(0.05, 0.25)), "velocity": Vector2(randf_range(-0.1, 0.1), randf_range(0.05, 0.3)), "life": 2.8, "color": [MetroStyle.LIME, MetroStyle.ORANGE, Color("8bdcc1")][index % 3], "size": randf_range(2, 5)})

func reset() -> void:
	door_open = 1.0
	train_offset = 0.0
	player_progress = 0.0
	celebrate = 0.0
	floating.clear()
	particles.clear()

func _process(delta: float) -> void:
	var reduced: bool = Metro.profile.settings.reduced_motion
	if not reduced and Metro.session.mode != "paused": clock += delta
	var mode: String = Metro.session.mode if not preview else "idle"
	var desired_open := 0.0 if mode == "lost" else (clampf(Metro.session.time_left / 2.0, 0.15, 1.0) if mode == "playing" else 1.0)
	door_open = lerpf(door_open, desired_open, minf(1.0, delta * 4))
	if mode == "lost": train_offset = minf(1.2, train_offset + delta * 0.25)
	elif train_offset > 0: train_offset = maxf(0, train_offset - delta * 2)
	player_lane = lerpf(player_lane, float(Metro.session.lane), minf(1, delta * 13))
	player_progress = lerpf(player_progress, Metro.session.progress() if not preview else 0.1, minf(1, delta * 8))
	punch = maxf(0, punch - delta * 8)
	flash = maxf(0, flash - delta * 3)
	celebrate = maxf(0, celebrate - delta * 0.4)
	for entry in particles:
		entry.life -= delta
		entry.pos += entry.velocity * delta
		entry.velocity.y += delta * 0.06
	particles = particles.filter(func(entry: Dictionary) -> bool: return entry.life > 0)
	for entry in floating:
		entry.life -= delta
		entry.pos.y -= delta * 0.07
	floating = floating.filter(func(entry: Dictionary) -> bool: return entry.life > 0)
	queue_redraw()

func _draw() -> void:
	if size.x <= 0 or size.y <= 0: return
	var w := size.x
	var h := size.y
	var station := Metro.current_station()
	var station_color := Color(station.theme)
	var route_color := Color(Metro.current_route().color)
	draw_rect(Rect2(Vector2.ZERO, size), Color("17262b"))
	# Station architecture: warm stone, directional tiled floor, ceiling ribs.
	_poly([Vector2.ZERO, Vector2(w, 0), Vector2(w * 0.84, h * 0.29), Vector2(w * 0.16, h * 0.29)], Color("30433f"))
	for index in range(7):
		var y := h * (0.025 + index * 0.035)
		draw_line(Vector2(w * index * 0.017, y), Vector2(w - w * index * 0.017, y), Color("41534a"), maxf(1.0, h * 0.008), true)
	# Ceiling light strips, pillars, wall mosaics and station name.
	_poly([Vector2(w * 0.12, 0), Vector2(w * 0.145, 0), Vector2(w * 0.26, h * 0.27), Vector2(w * 0.25, h * 0.27)], Color("bbc9a9"))
	_poly([Vector2(w * 0.855, 0), Vector2(w * 0.88, 0), Vector2(w * 0.75, h * 0.27), Vector2(w * 0.74, h * 0.27)], Color("bbc9a9"))
	_poly([Vector2(0, 0), Vector2(w * 0.17, h * 0.26), Vector2(w * 0.17, h * 0.72), Vector2(0, h * 0.98)], station_color.darkened(0.24))
	_poly([Vector2(w, 0), Vector2(w * 0.83, h * 0.26), Vector2(w * 0.83, h * 0.72), Vector2(w, h * 0.98)], station_color.darkened(0.34))
	for side in [0, 1]:
		for index in range(6):
			var y := h * (0.16 + index * 0.11)
			var edge := w * 0.15 if side == 0 else w * 0.85
			draw_line(Vector2(0 if side == 0 else w, y), Vector2(edge, h * 0.24 + index * h * 0.063), station_color.darkened(0.36), 1, true)
	for x in [0.10, 0.89]:
		_poly([Vector2(w * (x - 0.035), h * 0.08), Vector2(w * (x + 0.01), h * 0.14), Vector2(w * (x + 0.01), h * 0.77), Vector2(w * (x - 0.035), h * 0.87)], station_color.lightened(0.1))
		_poly([Vector2(w * (x + 0.01), h * 0.14), Vector2(w * (x + 0.025), h * 0.12), Vector2(w * (x + 0.025), h * 0.76), Vector2(w * (x + 0.01), h * 0.77)], station_color.darkened(0.1))
	# Station-specific wall patterns keep every stop visually recognisable.
	var motif: int = absi(str(station.id).hash()) % 4
	for side in [0, 1]:
		var wall_x := w * (0.045 if side == 0 else 0.925)
		for index in range(4):
			var yy := h * (0.28 + index * 0.095)
			var ink := station_color.lightened(0.18)
			if motif == 0:
				draw_arc(Vector2(wall_x, yy), w * 0.014, 0, TAU, 16, ink, 1.2, true)
			elif motif == 1:
				_poly([Vector2(wall_x, yy - h * 0.022), Vector2(wall_x + w * 0.018, yy), Vector2(wall_x, yy + h * 0.022), Vector2(wall_x - w * 0.018, yy)], ink.darkened(0.16))
			elif motif == 2:
				draw_line(Vector2(wall_x - w * 0.017, yy), Vector2(wall_x + w * 0.017, yy), ink, 2, true)
			else:
				draw_arc(Vector2(wall_x, yy + h * 0.022), w * 0.02, PI, TAU, 20, ink, 1.2, true)
	draw_rect(Rect2(w * 0.16, h * 0.21, w * 0.68, h * 0.1), Color("213333"))
	_text(station.short.to_upper(), Vector2(w * 0.5, h * 0.277), int(clampf(w * 0.022, 11, 19)), Color("f2e6cf"), true)
	# Floor starts behind the train; perspective lines converge into its entrance.
	_poly([Vector2(w * 0.17, h * 0.57), Vector2(w * 0.83, h * 0.57), Vector2(w, h), Vector2(0, h)], Color("9d9e83"))
	for index in range(13):
		var end_x := w * (float(index) / 12)
		draw_line(Vector2(w * 0.5 + (end_x - w * 0.5) * 0.27, h * 0.58), Vector2(end_x, h), Color("7d8775"), 1, true)
	for depth in [0.0, 0.10, 0.23, 0.40, 0.64, 0.96]:
		var y: float = h * (0.59 + depth * 0.4)
		draw_line(Vector2(0, y), Vector2(w, y), Color("808875"), 1, true)
	# Yellow tactile safety strip is behind the running character, not an input.
	_poly([Vector2(w * 0.15, h * 0.64), Vector2(w * 0.85, h * 0.64), Vector2(w * 0.90, h * 0.665), Vector2(w * 0.10, h * 0.665)], Color("ccbb6c"))
	for index in range(32):
		draw_circle(Vector2(w * (0.16 + index * 0.022), h * 0.651), 1.2, Color("a89b57"))
	_train(w, h, route_color)
	# Static live commuters around the entrance create depth and a full carriage.
	for index in range(10):
		var x := w * (0.20 + float(index) * 0.055)
		var y := h * (0.61 + sin(index * 2.4) * 0.02)
		if index in [4, 5, 6, 7]: continue
		MetroCharacter.draw_person(self, Vector2(x + train_offset * w, y), minf(h * 0.00175, w * 0.00175), index, false, {}, sin(clock + index) * 0.1)
	# Narrow crowd-lined perspective lane. Active obstacles approach the player.
	var count: int = Metro.session.obstacles.size()
	for index in range(6):
		var depth := float(index) / 5.0
		var y := h * (0.67 + depth * 0.29)
		var spread := w * (0.25 + depth * 0.16)
		var s := minf(h * (0.0019 + depth * 0.0011), w * (0.0020 + depth * 0.0010))
		for side in [-1, 1]:
			MetroCharacter.draw_person(self, Vector2(w * 0.5 + spread * side + sin(clock * 0.7 + index) * 1.2, y), s, index * 3 + (2 if side == 1 else 0), side == 1, {}, sin(clock * 0.5 + index) * 0.15)
	if count > 0:
		for index in range(count - 1, -1, -1):
			if index < Metro.session.obstacle_index and not preview: continue
			var relative := float(index - (0 if preview else Metro.session.obstacle_index))
			var depth := clampf(1.0 - relative * 0.17, 0.05, 1.0)
			var obstacle: Dictionary = Metro.session.obstacles[index]
			var x := w * (0.5 + (float(obstacle.lane) - 1.0) * (0.06 + depth * 0.085))
			var y := h * (0.66 + depth * 0.14)
			var s := minf(h * (0.00135 + depth * 0.0011), w * (0.0015 + depth * 0.0011))
			_obstacle(obstacle, Vector2(x, y), s, index, depth)
	# Lane guide and the controllable commuter.
	var player_y := h * (0.96 - player_progress * 0.25)
	var player_x := w * (0.5 + (player_lane - 1.0) * (0.14 - player_progress * 0.04))
	if not preview and Metro.session.mode == "won":
		player_y = lerpf(player_y, h * 0.61, 1.0 - celebrate)
		player_x = lerpf(player_x, w * 0.5, 1.0 - celebrate)
	if not preview:
		_ellipse(Vector2(player_x, player_y), Vector2(w * 0.048, h * 0.023), Color(0.56, 0.79, 0.34, 0.25))
		draw_arc(Vector2(player_x, player_y), w * 0.05, 0.05, PI - 0.05, 28, MetroStyle.LIME, 1.5, true)
	var running: bool = not preview and Metro.session.mode == "playing"
	var motion := clock * (9.0 + float(Metro.player_stats().speed) * 2.0) if running else sin(clock) * 0.08
	MetroCharacter.draw_person(self, Vector2(player_x, player_y - punch * h * 0.012), minf(h * (0.0032 - player_progress * 0.001), w * (0.0035 - player_progress * 0.0011)), -1, true, Metro.profile.equipped, motion, float(Metro.player_stats().size))
	# Corner vignette keeps HUD text crisp without hiding the illustrated scene.
	for index in range(16):
		var alpha := 0.04 * (1.0 - index / 16.0)
		draw_rect(Rect2(0, index * h * 0.012, w, h * 0.012), Color(0.015, 0.045, 0.048, alpha + 0.02))
	if not preview and Metro.session.wave_active():
		for index in range(3):
			var yy := h * 0.68 + index * h * 0.035
			draw_line(Vector2(w * 0.22, yy), Vector2(w * 0.78, yy), Color(1.0, 0.57, 0.40, 0.12), h * 0.018, true)
	if flash > 0:
		draw_rect(Rect2(Vector2.ZERO, size), Color(0.6, 1.0, 0.32, flash * 0.06))
	for entry in particles:
		var color: Color = entry.color
		color.a = minf(1, entry.life * 3)
		draw_rect(Rect2(entry.pos * size, Vector2.ONE * entry.size), color)
	for entry in floating:
		var color: Color = entry.color
		color.a = minf(1, entry.life * 2)
		_text(entry.text, entry.pos * size, int(clampf(w * 0.024, 14, 21)), color, true)

func _train(w: float, h: float, line_color: Color) -> void:
	var x := train_offset * w
	var train_rect := Rect2(w * 0.17 + x, h * 0.31, w * 0.66, h * 0.33)
	_round(train_rect, Color("b9c5b5"), 12)
	draw_rect(Rect2(train_rect.position + Vector2(0, h * 0.036), Vector2(train_rect.size.x, h * 0.048)), Color("889e90"))
	draw_rect(Rect2(w * 0.17 + x, h * 0.548, w * 0.66, h * 0.061), line_color.darkened(0.14))
	draw_rect(Rect2(w * 0.17 + x, h * 0.608, w * 0.66, h * 0.018), Color("344d45"))
	for window_x in [0.22, 0.69]:
		_round(Rect2(w * window_x + x, h * 0.405, w * 0.092, h * 0.105), Color("223c38"), 7)
		_poly([Vector2(w * window_x + x, h * 0.411), Vector2(w * (window_x + 0.03) + x, h * 0.411), Vector2(w * (window_x + 0.075) + x, h * 0.50), Vector2(w * (window_x + 0.05) + x, h * 0.50)], Color(0.75, 0.84, 0.75, 0.09))
	var doorway := Rect2(w * 0.385 + x, h * 0.377, w * 0.23, h * 0.257)
	_round(doorway, Color("162d2a"), 5)
	draw_rect(Rect2(w * 0.398 + x, h * 0.385, w * 0.204, h * 0.026), Color("bddac0"))
	for rail_x in [0.425, 0.575]:
		draw_line(Vector2(w * rail_x + x, h * 0.416), Vector2(w * rail_x + x, h * 0.59), Color("9daea2"), 2, true)
	for index in range(6):
		var xx := w * (0.416 + index * 0.034) + x
		MetroCharacter.draw_person(self, Vector2(xx, h * (0.607 - (index % 2) * 0.009)), h * 0.00142, 3 + index, false, {}, 0)
	# Door leaves slide over the doorway as the genuine timer reaches zero.
	var leaf_width := w * 0.115
	var travel := leaf_width * door_open
	for side in [-1, 1]:
		var leaf_x := w * 0.5 + x - (leaf_width + travel if side == -1 else -travel)
		_round(Rect2(leaf_x, doorway.position.y, leaf_width, doorway.size.y), Color("aebdaa"), 4)
		_round(Rect2(leaf_x + leaf_width * 0.14, h * 0.402, leaf_width * 0.72, h * 0.105), Color("30483f"), 4)
		draw_rect(Rect2(leaf_x, h * 0.548, leaf_width, h * 0.061), line_color.darkened(0.12))
		draw_line(Vector2(leaf_x + leaf_width * 0.88, h * 0.516), Vector2(leaf_x + leaf_width * 0.88, h * 0.542), Color("4f6556"), 2, true)
	_round(Rect2(w * 0.418 + x, h * 0.333, w * 0.164, h * 0.028), Color("18342a"), 3)
	_text("QAPILAR AÇIQDIR" if door_open > 0.5 else "QAPILAR BAĞLANIR", Vector2(w * 0.5 + x, h * 0.352), int(clampf(w * 0.01, 6, 9)), line_color, true)
	draw_line(Vector2(w * 0.387 + x, h * 0.632), Vector2(w * 0.613 + x, h * 0.632), Color("dbe1c9"), 3, true)

func _obstacle(obstacle: Dictionary, point: Vector2, factor: float, index: int, depth: float) -> void:
	match obstacle.kind:
		"passenger", "crowd", "phone":
			MetroCharacter.draw_person(self, point, factor, index + 3, false, {}, sin(clock + index) * 0.16)
			if obstacle.kind == "crowd":
				MetroCharacter.draw_person(self, point + Vector2(21 * factor, 4 * factor), factor * 0.91, index + 5, true)
			if obstacle.kind == "phone":
				_round(Rect2(point.x + 13 * factor, point.y - 70 * factor, 9 * factor, 14 * factor), Color("293f47"), 2)
				_round(Rect2(point.x + 15 * factor, point.y - 68 * factor, 5 * factor, 10 * factor), Color("8eaca8"), 1)
		"suitcase":
			draw_set_transform(point, 0, Vector2.ONE * factor)
			_round(Rect2(-22, -55, 44, 48), Color("b98c60"), 6)
			draw_arc(Vector2(0, -56), 8, PI, TAU, 14, Color("5f5845"), 3, true)
			for yy in [-42, -29, -16]: draw_line(Vector2(-16, yy), Vector2(16, yy), Color("9e744e"), 2, true)
			draw_circle(Vector2(-16, -4), 4, Color("37464a"))
			draw_circle(Vector2(16, -4), 4, Color("37464a"))
			draw_set_transform(Vector2.ZERO)
		"clock":
			var radius := factor * 17
			var center := point - Vector2(0, factor * 52 + sin(clock * 2 + index) * 2)
			draw_circle(center, radius + factor * 6, Color(0.99, 0.78, 0.34, 0.11))
			draw_circle(center, radius, Color("eac67d"))
			draw_arc(center, radius - factor * 3, 0, TAU, 32, Color("745f39"), 1.3, true)
			draw_line(center, center - Vector2(0, radius * 0.52), Color("5e5134"), 2, true)
			draw_line(center, center + Vector2(radius * 0.45, radius * 0.18), Color("5e5134"), 2, true)
			_text("+%.0fs" % obstacle.time_bonus, point - Vector2(0, factor * 17), int(clampf(factor * 11, 8, 15)), Color("ffe3a8"), true)
		"barrier":
			draw_set_transform(point, 0, Vector2.ONE * factor)
			_round(Rect2(-34, -53, 68, 17), Color("ddb273"), 3)
			for xx in [-22, -2, 18]:
				_poly([Vector2(xx, -53), Vector2(xx + 10, -53), Vector2(xx - 1, -36), Vector2(xx - 11, -36)], Color("545e54"))
			draw_line(Vector2(-27, -38), Vector2(-29, 0), Color("7c8270"), 4, true)
			draw_line(Vector2(27, -38), Vector2(29, 0), Color("7c8270"), 4, true)
			draw_set_transform(Vector2.ZERO)
		"wetfloor":
			_ellipse(point - Vector2(0, 8 * factor), Vector2(42, 9) * factor, Color(0.48, 0.69, 0.71, 0.5))
			_poly([point + Vector2(-15, -4) * factor, point + Vector2(0, -51) * factor, point + Vector2(19, -4) * factor], Color("e5bc64"))
			_text("!", point + Vector2(2, -16) * factor, int(clampf(factor * 22, 9, 25)), Color("5c583a"), true)
	if depth > 0.9 and not preview:
		var bar_width := 54 * factor
		var bar_y := point.y - factor * (146 if obstacle.kind in ["passenger", "crowd", "phone"] else 87)
		_round(Rect2(point.x - bar_width * 0.5, bar_y, bar_width, 4 * factor), Color("304d41"), 2)
		_round(Rect2(point.x - bar_width * 0.5, bar_y, bar_width * float(obstacle.hp) / float(obstacle.max_hp), 4 * factor), MetroStyle.ORANGE if obstacle.kind == "clock" else MetroStyle.LIME, 2)

func _text(text: String, point: Vector2, text_size: int, color: Color, centered: bool = false) -> void:
	var active_font: Font = font if font != null else ThemeDB.fallback_font
	var width := active_font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, text_size).x
	draw_string(active_font, point - Vector2(width / 2 if centered else 0.0, 0), text, HORIZONTAL_ALIGNMENT_LEFT, -1, text_size, color)

func _round(rect: Rect2, color: Color, radius: int) -> void:
	draw_style_box(MetroStyle.box(color, radius, color, 0), rect)

func _poly(points: Array, color: Color) -> void:
	draw_colored_polygon(PackedVector2Array(points), color)

func _ellipse(center: Vector2, radii: Vector2, color: Color) -> void:
	var points := PackedVector2Array()
	for index in range(32): points.append(center + Vector2.from_angle(index * TAU / 32) * radii)
	draw_colored_polygon(points, color)
