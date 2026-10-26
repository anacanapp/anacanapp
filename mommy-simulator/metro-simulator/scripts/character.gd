class_name MetroCharacter
extends RefCounted

# All commuter art is original vector drawing. Both the live platform and the
# wardrobe use the same renderer so purchased equipment visibly changes play.
static func draw_person(canvas: CanvasItem, position: Vector2, scale_value: float, palette_index: int = 0, facing_back: bool = false, equipment: Dictionary = {}, motion: float = 0.0, bulk: float = 1.0) -> void:
	var coats := [Color("a57b67"), Color("637e76"), Color("86979d"), Color("c4aa76"), Color("65707d"), Color("b08b88"), Color("d4bca0"), Color("788a67")]
	var skins := [Color("e8b595"), Color("d8a685"), Color("c98f71"), Color("efc4a2")]
	var coat: Color = coats[posmod(palette_index, coats.size())]
	var skin: Color = skins[posmod(palette_index, skins.size())]
	var player := palette_index == -1
	if player:
		coat = Color("b7f36b") if equipment.get("body") != "jacket" else Color("a895e8")
		skin = Color("e4b092")
	canvas.draw_set_transform(position, 0.0, Vector2.ONE * scale_value)
	var step := sin(motion) * 4.5
	var width := 18.0 * bulk
	# Soft ground shadow, trousers and trainers.
	_ellipse(canvas, Vector2(0, -1), Vector2(width + 10, 6), Color(0.015, 0.035, 0.036, 0.36))
	var trousers := Color("2f4449") if player else Color("354247")
	_poly(canvas, [Vector2(-width + 3, -49), Vector2(-2, -46), Vector2(-3 + step, -6), Vector2(-16 + step, -6)], trousers)
	_poly(canvas, [Vector2(1, -46), Vector2(width - 3, -49), Vector2(15 - step, -6), Vector2(3 - step, -6)], trousers.lightened(0.06))
	var shoe_color := Color("d3ead0") if equipment.get("feet") == "sneakers" else Color("d0d4c9")
	_round(canvas, Rect2(-19 + step, -9, 19, 9), shoe_color, 3)
	_round(canvas, Rect2(2 - step, -9, 19, 9), shoe_color.darkened(0.1), 3)
	canvas.draw_line(Vector2(-18 + step, -2), Vector2(-1 + step, -2), Color("536363"), 1, true)
	canvas.draw_line(Vector2(3 - step, -2), Vector2(20 - step, -2), Color("536363"), 1, true)
	# Torso, neck, shirt hem and sleeves.
	_round(canvas, Rect2(-width, -88, width * 2, 45), coat, 9)
	_poly(canvas, [Vector2(-width, -62), Vector2(width, -58), Vector2(width - 1, -44), Vector2(-width + 1, -44)], coat.darkened(0.08))
	_round(canvas, Rect2(-7, -99, 14, 18), skin.darkened(0.05), 4)
	canvas.draw_line(Vector2(-width + 3, -47), Vector2(width - 3, -47), coat.darkened(0.26), 1.3, true)
	var arm_swing := sin(motion + 0.8) * 6
	canvas.draw_line(Vector2(-width + 1, -80), Vector2(-width - 8 - arm_swing * 0.25, -52), coat.darkened(0.07), 12, true)
	canvas.draw_line(Vector2(width - 1, -80), Vector2(width + 7 + arm_swing * 0.25, -53), coat.lightened(0.07), 12, true)
	var hands := Color("5a4840") if equipment.get("hands") == "gloves" else skin
	canvas.draw_circle(Vector2(-width - 8 - arm_swing * 0.25, -49), 5.5, hands)
	canvas.draw_circle(Vector2(width + 7 + arm_swing * 0.25, -50), 5.5, hands)
	if equipment.get("accessory") == "watch":
		_round(canvas, Rect2(width + 3, -58, 10, 5), Color("4c5556"), 2)
		canvas.draw_circle(Vector2(width + 8, -56), 3, Color("b3e3e6"))
	# Character head has ears, a shaped hairline and tiny readable facial detail.
	canvas.draw_circle(Vector2(-15, -109), 4, skin.darkened(0.07))
	canvas.draw_circle(Vector2(15, -109), 4, skin)
	_round(canvas, Rect2(-15, -131, 30, 34), skin, 12)
	var hair := Color("3a342f") if palette_index % 3 != 1 else Color("665345")
	if facing_back:
		_round(canvas, Rect2(-15, -132, 30, 30), hair, 11)
		canvas.draw_arc(Vector2(0, -117), 12, 3.7, 5.7, 12, hair.lightened(0.12), 2, true)
	else:
		_poly(canvas, [Vector2(-15, -115), Vector2(-16, -125), Vector2(-9, -133), Vector2(7, -134), Vector2(15, -126), Vector2(16, -113), Vector2(11, -120), Vector2(-2, -123), Vector2(-10, -117)], hair)
		canvas.draw_circle(Vector2(-5.5, -112), 1.4, Color("423b32"))
		canvas.draw_circle(Vector2(5.5, -112), 1.4, Color("423b32"))
		canvas.draw_line(Vector2(-3, -102), Vector2(4, -102), skin.darkened(0.26), 1.2, true)
		canvas.draw_line(Vector2(1, -110), Vector2(2, -106), skin.darkened(0.1), 1, true)
	if player and facing_back:
		# Minimal reflective metro insignia.
		canvas.draw_line(Vector2(-9, -76), Vector2(-9, -64), coat.darkened(0.6), 2, true)
		canvas.draw_polyline(PackedVector2Array([Vector2(-9, -76), Vector2(0, -66), Vector2(9, -76), Vector2(9, -64)]), coat.darkened(0.6), 2, true)
	if equipment.get("back") == "backpack":
		_round(canvas, Rect2(-13, -85, 26, 32), Color("be9274"), 7)
		_round(canvas, Rect2(-9, -65, 18, 9), Color("a9785e"), 3)
		canvas.draw_line(Vector2(-17, -81), Vector2(-17, -51), Color("6d574b"), 2, true)
		canvas.draw_line(Vector2(17, -81), Vector2(17, -51), Color("6d574b"), 2, true)
	if equipment.get("head") == "helmet":
		canvas.draw_arc(Vector2(0, -121), 19, PI, TAU, 22, Color("f1bd64"), 15, true)
		_round(canvas, Rect2(-21, -123, 42, 5), Color("dca44b"), 2)
		canvas.draw_line(Vector2(0, -139), Vector2(0, -125), Color("ffe2a0"), 4, true)
	elif equipment.get("head") == "headphones":
		canvas.draw_arc(Vector2(0, -118), 18, PI, TAU, 20, Color("c0d9d0"), 3, true)
		_round(canvas, Rect2(-21, -119, 8, 15), Color("4c6e64"), 3)
		_round(canvas, Rect2(13, -119, 8, 15), Color("4c6e64"), 3)
	canvas.draw_set_transform(Vector2.ZERO)

static func _round(canvas: CanvasItem, rect: Rect2, color: Color, radius: int) -> void:
	canvas.draw_style_box(MetroStyle.box(color, radius, color, 0), rect)

static func _poly(canvas: CanvasItem, points: Array, color: Color) -> void:
	canvas.draw_colored_polygon(PackedVector2Array(points), color)

static func _ellipse(canvas: CanvasItem, center: Vector2, radii: Vector2, color: Color) -> void:
	var points := PackedVector2Array()
	for index in range(36):
		points.append(center + Vector2(cos(index * TAU / 36), sin(index * TAU / 36)) * radii)
	canvas.draw_colored_polygon(points, color)
