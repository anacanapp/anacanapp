class_name MetroStyle
extends RefCounted

const BG := Color("091215")
const PANEL := Color("111e21")
const PANEL_LIGHT := Color("17272a")
const BORDER := Color("293b3d")
const TEXT := Color("f0f3e9")
const MUTED := Color("8fa5a5")
const LIME := Color("b7f36b")
const LIME_DARK := Color("192d20")
const ORANGE := Color("ffc978")
const RED := Color("ff8576")

static func box(color: Color = PANEL, radius: int = 18, border: Color = BORDER, border_width: int = 1) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = color
	style.set_corner_radius_all(radius)
	style.border_color = border
	style.set_border_width_all(border_width)
	style.content_margin_left = 16
	style.content_margin_right = 16
	style.content_margin_top = 12
	style.content_margin_bottom = 12
	return style

static func slim_box(color: Color, radius: int = 2) -> StyleBoxFlat:
	var style := box(color, radius, color, 0)
	style.content_margin_left = 0
	style.content_margin_right = 0
	style.content_margin_top = 0
	style.content_margin_bottom = 0
	return style

static func button_style(button: Button, active: bool = false, primary: bool = false, small: bool = false) -> void:
	button.add_theme_stylebox_override("normal", box(LIME if primary else (LIME_DARK if active else PANEL_LIGHT), 12, LIME if active else BORDER, 0 if primary else 1))
	button.add_theme_stylebox_override("hover", box(LIME.lightened(0.06) if primary else Color("263a30"), 12, LIME.darkened(0.35), 1))
	button.add_theme_stylebox_override("pressed", box(LIME.darkened(0.12) if primary else Color("304439"), 12, LIME, 1))
	button.add_theme_stylebox_override("disabled", box(Color("182529"), 12, Color("29383b"), 1))
	button.add_theme_stylebox_override("focus", box(Color(0, 0, 0, 0), 12, LIME, 2))
	button.add_theme_color_override("font_color", Color("132015") if primary else (LIME if active else TEXT))
	button.add_theme_color_override("font_hover_color", Color("132015") if primary else TEXT)
	button.add_theme_color_override("font_pressed_color", Color("132015") if primary else LIME)
	button.add_theme_color_override("font_disabled_color", Color("64777a"))
	button.add_theme_font_size_override("font_size", 13 if small else 15)
	button.custom_minimum_size.y = 40 if small else 50
	button.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	button.focus_mode = Control.FOCUS_ALL

static func label(text: String, size: int = 14, color: Color = TEXT) -> Label:
	var control := Label.new()
	control.text = text
	control.add_theme_color_override("font_color", color)
	control.add_theme_font_size_override("font_size", maxi(10, size))
	control.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return control

static func margin(all: int = 18) -> MarginContainer:
	var control := MarginContainer.new()
	for edge in ["left", "right", "top", "bottom"]:
		control.add_theme_constant_override("margin_" + edge, all)
	return control

static func vbox(gap: int = 12) -> VBoxContainer:
	var control := VBoxContainer.new()
	control.add_theme_constant_override("separation", gap)
	return control

static func hbox(gap: int = 12) -> HBoxContainer:
	var control := HBoxContainer.new()
	control.add_theme_constant_override("separation", gap)
	return control

static func spacer() -> Control:
	var control := Control.new()
	control.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return control

static func panel(color: Color = PANEL, radius: int = 18) -> PanelContainer:
	var control := PanelContainer.new()
	control.add_theme_stylebox_override("panel", box(color, radius))
	return control
