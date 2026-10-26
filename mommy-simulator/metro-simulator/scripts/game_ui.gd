extends Control

const INK := Color("0b1d28")
const BLUE := Color("264653")
const GOLD := Color("f4b76b")
const CREAM := Color("f4eee0")
const AQUA := Color("8ed9d0")
const MUTED := Color("b4c4c8")

var world: MetroWorld3D
var ui: Control
var overlay: Control
var controls: Dictionary = {}
var handlers: Dictionary = {}
var view := "home"
var filter := "all"
var compact := true
var landscape := false
var logical_size := Vector2(430, 900)
var normal_font: Font
var strong_font: Font
var display_font: Font
var last_mode := ""
var last_door := -1
var toast_left := 0.0
var toast: Label
var audio: MetroAudio
var modal_open := false
var progress_bar: ProgressBar
var energy_bar: ProgressBar
var combo_label: Label
var hint_label: Label
var tap_ring: Control
var browser_callback: JavaScriptObject
var browser_elapsed := 0.0
var countdown_label: Label
var coins_label: Label
var resize_pending := false

func _ready() -> void:
	if "--self-test" in OS.get_cmdline_user_args():
		call_deferred("_self_test")
		return
	if OS.has_feature("ios"): Engine.max_fps = 60
	var base: Font = load("res://assets/fonts/NotoSans.ttf")
	var normal := FontVariation.new()
	normal.base_font = base
	normal.variation_opentype = {"wght": 550}
	normal_font = normal
	var strong := FontVariation.new()
	strong.base_font = base
	strong.variation_opentype = {"wght": 800}
	strong_font = strong
	display_font = load("res://assets/fonts/BarlowCondensed-SemiBold.ttf")
	display_font.fallbacks = [base, ThemeDB.fallback_font]
	var game_theme := Theme.new()
	game_theme.default_font = normal_font
	game_theme.default_font_size = 13
	theme = game_theme
	world = MetroWorld3D.new()
	add_child(world)
	ui = Control.new()
	ui.mouse_filter = MOUSE_FILTER_IGNORE
	add_child(ui)
	audio = MetroAudio.new()
	add_child(audio)
	Metro.purchase_result.connect(_purchase_result)
	Metro.profile_changed.connect(_profile_changed)
	get_viewport().size_changed.connect(_resize_later)
	if OS.has_feature("web"):
		browser_callback = JavaScriptBridge.create_callback(_browser_action)
		JavaScriptBridge.get_interface("window").metroAction = browser_callback
	_resize()
	print("METRO_READY | Real 3D / Mobile game HUD / 1.1.0")
	if OS.get_environment("METRO_DEVICE_ACCEPTANCE") == "1": call_deferred("_physical_acceptance")
	elif OS.has_feature("ios"): call_deferred("_native_ready_receipt")

func _self_test() -> void:
	var report: Dictionary = load("res://tests/acceptance.gd").new().run(Metro)
	print("METRO_ACCEPTANCE " + JSON.stringify(report))
	get_tree().quit(0 if report.failures.is_empty() else 1)

func _resize_later() -> void:
	if resize_pending or ui == null: return
	resize_pending = true
	call_deferred("_resize")

func _resize() -> void:
	resize_pending = false
	var available := get_viewport_rect().size
	var scale_value := minf(1, available.x / 390)
	ui.position = Vector2.ZERO
	if OS.has_feature("ios"):
		var safe := DisplayServer.get_display_safe_area()
		ui.position = Vector2(safe.position)
		available = Vector2(safe.size)
		scale_value = maxf(1, DisplayServer.screen_get_scale())
		scale_value *= minf(1, available.x / scale_value / 390)
	ui.scale = Vector2.ONE * scale_value
	ui.size = available / scale_value
	logical_size = ui.size
	landscape = logical_size.x > logical_size.y
	compact = logical_size.x < 700
	_rebuild()

func _rebuild() -> void:
	if ui == null: return
	for child in ui.get_children():
		ui.remove_child(child)
		child.queue_free()
	controls.clear()
	handlers.clear()
	progress_bar = null
	energy_bar = null
	combo_label = null
	hint_label = null
	countdown_label = null
	modal_open = false
	world.set_view(view)
	var vignette := ColorRect.new()
	_full(vignette)
	vignette.mouse_filter = MOUSE_FILTER_IGNORE
	var shader := ShaderMaterial.new()
	shader.shader = load("res://shaders/vignette.gdshader")
	shader.set_shader_parameter("intensity", 0.32 if view == "home" else 0.18)
	vignette.material = shader
	ui.add_child(vignette)
	match view:
		"home": _home()
		"play": _play()
		"map": _map()
		"shop": _shop()
		"profile": _profile()
		"settings": _settings()
	toast = _label("", 12, CREAM)
	toast.add_theme_stylebox_override("normal", _panel_box(Color("223e43"), 10, GOLD.darkened(0.25)))
	toast.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	toast.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	toast.position = Vector2(20, logical_size.y - 122)
	toast.size = Vector2(logical_size.x - 40, 46)
	toast.mouse_filter = MOUSE_FILTER_IGNORE
	toast.visible = false
	ui.add_child(toast)
	last_mode = ""
	last_door = -1
	_browser_state()

func _home() -> void:
	_top_wallet()
	# This is a game lobby over a live 3D metro platform, with one clear CTA.
	var logo := VBoxContainer.new()
	logo.add_theme_constant_override("separation", 3)
	logo.position = Vector2(24 if compact else 56, logical_size.y * (0.09 if landscape else 0.10))
	ui.add_child(logo)
	logo.add_child(_display("METRO", 86 if compact else 116, CREAM))
	var subtitle := _label("S I M U L A T O R", 15 if compact else 18, GOLD)
	subtitle.add_theme_font_override("font", strong_font)
	logo.add_child(subtitle)
	var small := _label("BAKI  •  PİK SAAT", 10, Color("d1dedc"))
	logo.add_child(small)
	var rail := ColorRect.new()
	rail.color = GOLD
	rail.custom_minimum_size = Vector2(88, 3)
	logo.add_child(rail)
	var missions := _button("", "open-map", func() -> void: _navigate("map"), "blue")
	missions.tooltip_text = "Metro xəritəsi"
	missions.position = Vector2(16 if compact else 50, logical_size.y * 0.40)
	missions.size = Vector2(48, 52)
	_icon_button(missions, "map", GOLD, 25)
	ui.add_child(missions)
	var gear := _button("", "open-shop", func() -> void: _navigate("shop"), "blue")
	gear.tooltip_text = "Avadanlıq"
	gear.position = missions.position + Vector2(0, 64)
	gear.size = Vector2(48, 52)
	_icon_button(gear, "shop", GOLD, 25)
	ui.add_child(gear)
	var rank := _label(MetroRules.rank_name(int(Metro.profile.xp)).to_upper(), 11, CREAM)
	rank.add_theme_stylebox_override("normal", _panel_box(Color(0.04, 0.13, 0.16, 0.72), 8, Color("65898b")))
	rank.position = Vector2(logical_size.x - 183, logical_size.y * 0.44)
	rank.size = Vector2(164, 35)
	rank.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	ui.add_child(rank)
	var width := minf(450, logical_size.x - 40)
	var lower := VBoxContainer.new()
	lower.position = Vector2((logical_size.x - width) * 0.5, logical_size.y - 265)
	lower.size = Vector2(width, 225)
	lower.add_theme_constant_override("separation", 11)
	ui.add_child(lower)
	var route := Metro.current_route()
	var station := Metro.current_station()
	var ticket := PanelContainer.new()
	ticket.add_theme_stylebox_override("panel", _panel_box(Color(0.055, 0.13, 0.17, 0.90), 12, GOLD.darkened(0.32)))
	lower.add_child(ticket)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 6)
	ticket.add_child(column)
	var top := HBoxContainer.new()
	top.add_child(_label(route.line, 10, Color(route.color)))
	top.add_child(_spacer())
	top.add_child(_label("MƏRHƏLƏ %02d / %02d" % [Metro.selected_station + 1, route.stations.size()], 10, MUTED))
	column.add_child(top)
	column.add_child(_display(station.short.to_upper(), 29, CREAM))
	var bottom := HBoxContainer.new()
	bottom.add_child(_label("%d QAPI  •  %.1f SANİYƏ" % [Metro.session.doors_total, Metro.session.initial_time], 10, MUTED))
	bottom.add_child(_spacer())
	bottom.add_child(_label(route.to, 10, GOLD))
	column.add_child(bottom)
	var start := _button("OYNA", "start", _start_run, "gold")
	if Metro.session.mode in ["paused", "won", "lost"]: start.text = "DAVAM ET"
	start.custom_minimum_size.y = 64
	start.add_theme_font_override("font", display_font)
	start.add_theme_font_size_override("font_size", 32)
	lower.add_child(start)
	var tiny := _label("Qapılar bağlanmadan vaqona çat.", 11, MUTED)
	tiny.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lower.add_child(tiny)
	_bottom_nav()

func _top_wallet() -> void:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	row.position = Vector2(16, 8)
	row.size = Vector2(logical_size.x - 32, 43)
	ui.add_child(row)
	var emblem := _button("M", "nav:home", func() -> void: _navigate("home"), "blue")
	emblem.custom_minimum_size = Vector2(39, 39)
	emblem.add_theme_font_override("font", display_font)
	emblem.add_theme_font_size_override("font_size", 26)
	row.add_child(emblem)
	row.add_child(_spacer())
	var wallet := PanelContainer.new()
	wallet.add_theme_stylebox_override("panel", _panel_box(Color(0.06, 0.15, 0.19, 0.88), 9, Color("66828a")))
	row.add_child(wallet)
	var coins := HBoxContainer.new()
	coins.add_theme_constant_override("separation", 7)
	wallet.add_child(coins)
	coins.add_child(MetroIcon.new("coin", GOLD, 18))
	coins_label = _label(str(Metro.profile.coins), 15, CREAM)
	coins_label.add_theme_font_override("font", strong_font)
	coins.add_child(coins_label)
	var settings := _button("", "nav:settings", func() -> void: _navigate("settings"), "blue")
	settings.tooltip_text = "Ayarlar"
	settings.custom_minimum_size = Vector2(39, 39)
	_icon_button(settings, "settings", MUTED, 19)
	row.add_child(settings)

func _bottom_nav() -> void:
	var row := HBoxContainer.new()
	row.position = Vector2(18, logical_size.y - 59)
	row.size = Vector2(logical_size.x - 36, 47)
	row.add_theme_constant_override("separation", 8)
	ui.add_child(row)
	for entry in [{"id": "map", "name": "XƏRİTƏ", "icon": "map"}, {"id": "shop", "name": "AVADANLIQ", "icon": "shop"}, {"id": "profile", "name": "SƏRNİŞİN", "icon": "person"}]:
		var button := _button(entry.name, "nav:" + entry.id, func() -> void: _navigate(entry.id), "blue")
		button.size_flags_horizontal = SIZE_EXPAND_FILL
		button.add_theme_font_size_override("font_size", 10)
		row.add_child(button)

func _play() -> void:
	var w := logical_size.x
	var h := logical_size.y
	var top := HBoxContainer.new()
	top.position = Vector2(14, 8)
	top.size = Vector2(w - 28, 66)
	top.add_theme_constant_override("separation", 8)
	ui.add_child(top)
	var pause := _button("", "pause", _pause, "blue")
	pause.tooltip_text = "Fasilə"
	pause.custom_minimum_size = Vector2(40, 42)
	pause.action_mode = BaseButton.ACTION_MODE_BUTTON_PRESS
	_icon_button(pause, "pause", CREAM, 18)
	top.add_child(pause)
	var station_group := VBoxContainer.new()
	station_group.size_flags_horizontal = SIZE_EXPAND_FILL
	station_group.add_theme_constant_override("separation", 1)
	top.add_child(station_group)
	station_group.add_child(_label("BAKI  /  " + Metro.current_route().line, 9, Color(Metro.current_route().color)))
	station_group.add_child(_display(Metro.current_station().short.to_upper(), 25, CREAM))
	station_group.add_child(MetroGameWidgets.DoorTrack.new())
	var dial := MetroGameWidgets.TimerDial.new()
	dial.custom_minimum_size = Vector2(76, 76)
	top.add_child(dial)
	var bar_holder := VBoxContainer.new()
	bar_holder.position = Vector2(20, 93)
	bar_holder.size = Vector2(w - 40, 28)
	bar_holder.add_theme_constant_override("separation", 4)
	ui.add_child(bar_holder)
	var bar_labels := HBoxContainer.new()
	bar_labels.add_child(_label("VAQONA QƏDƏR", 9, MUTED))
	bar_labels.add_child(_spacer())
	combo_label = _label("KOMBO ×0", 11, GOLD)
	bar_labels.add_child(combo_label)
	bar_holder.add_child(bar_labels)
	progress_bar = _bar(AQUA, 4)
	bar_holder.add_child(progress_bar)
	# Thumb-zone controls are over the full 3D world. No webpage panels.
	var controls_width := minf(465, w - 20)
	var controls_holder := Control.new()
	controls_holder.position = Vector2((w - controls_width) * 0.5, h - 220 if not landscape else h - 148)
	controls_holder.size = Vector2(controls_width, 210)
	controls_holder.mouse_filter = MOUSE_FILTER_IGNORE
	ui.add_child(controls_holder)
	var horizontal := controls_width
	var tap_diameter := 100.0 if landscape else 118.0
	var tap := _button("TAP", "tap", _tap, "gold")
	tap.size = Vector2.ONE * tap_diameter
	tap.position = Vector2(horizontal * 0.5 - tap_diameter * 0.5, 66 if not landscape else 0)
	tap.add_theme_font_override("font", display_font)
	tap.add_theme_font_size_override("font_size", 42)
	tap.action_mode = BaseButton.ACTION_MODE_BUTTON_PRESS
	tap.focus_mode = FOCUS_NONE
	for state in ["normal", "hover", "pressed", "disabled"]:
		var box := tap.get_theme_stylebox(state).duplicate() as StyleBoxFlat
		box.set_corner_radius_all(64)
		tap.add_theme_stylebox_override(state, box)
	tap_ring = MetroGameWidgets.TapRing.new()
	tap_ring.position = tap.position - Vector2(9, 9)
	tap_ring.size = tap.size + Vector2(18, 18)
	controls_holder.add_child(tap_ring)
	controls_holder.add_child(tap)
	var lane_y := 84.0 if not landscape else 23.0
	for lane in range(3):
		var label: String = ["SOL", "ORTA", "SAĞ"][lane]
		var button := _button(label, "lane:" + str(lane), func() -> void: _lane(lane), "blue")
		button.add_theme_font_size_override("font_size", 11)
		button.custom_minimum_size = Vector2(48, 52)
		button.position = Vector2(14 if lane == 0 else horizontal - 62, lane_y)
		if lane == 1:
			button.position = Vector2(horizontal * 0.5 - 26, 3 if not landscape else -48)
			button.size = Vector2(52, 36)
			button.custom_minimum_size.y = 36
		controls_holder.add_child(button)
	var burst := _button("YOL AÇ\n60", "burst", _burst, "blue")
	burst.position = Vector2(horizontal - 74, 15 if not landscape else -54)
	burst.size = Vector2(62, 52)
	burst.add_theme_font_size_override("font_size", 10)
	burst.focus_mode = FOCUS_NONE
	controls_holder.add_child(burst)
	var energy := VBoxContainer.new()
	energy.position = Vector2(14, 12 if not landscape else -48)
	energy.size = Vector2(95, 40)
	energy.add_child(_label("ENERJİ", 9, AQUA))
	energy_bar = _bar(AQUA, 5)
	energy.add_child(energy_bar)
	controls_holder.add_child(energy)
	hint_label = _label("TAP ET · YOLUNU AÇ", 11, CREAM)
	hint_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hint_label.position = Vector2(15, h - 26)
	hint_label.size = Vector2(w - 30, 20)
	hint_label.add_theme_stylebox_override("normal", _panel_box(Color(0.04, 0.1, 0.12, 0.72), 6, Color(0, 0, 0, 0)))
	ui.add_child(hint_label)
	overlay = Control.new()
	_full(overlay)
	overlay.mouse_filter = MOUSE_FILTER_IGNORE
	ui.add_child(overlay)
	_game_update()

func _map() -> void:
	var page := _panel_page("METRO XƏRİTƏSİ", "27 STANSİYA · 5 MARŞRUT")
	page.add_child(_route_tabs())
	var diagram := MetroMapDiagram.new(Metro.selected_route, compact)
	diagram.custom_minimum_size.y = 80 + (int(ceil(float(Metro.current_route().stations.size()) / (3 if compact else 6))) - 1) * 68
	page.add_child(diagram)
	var grid := GridContainer.new()
	grid.columns = 1 if compact else 3
	grid.add_theme_constant_override("h_separation", 12)
	grid.add_theme_constant_override("v_separation", 9)
	page.add_child(grid)
	for index in range(Metro.current_route().stations.size()):
		var station: Dictionary = Metro.station_by_id(Metro.current_route().stations[index])
		var enabled := index <= int(Metro.profile.route_progress[Metro.selected_route])
		var text := "%02d   %s" % [index + 1, station.short]
		var key: String = Metro.selected_route + ":" + station.id
		if Metro.profile.station_results.has(key): text += "  ★"
		var button := _button(text, "station:" + str(index), func() -> void:
			if Metro.choose_station(index):
				view = "play"
				Metro.session.start()
				_rebuild(), "gold" if index == Metro.selected_station else "blue")
		button.disabled = not enabled
		button.size_flags_horizontal = SIZE_EXPAND_FILL
		button.custom_minimum_size.y = 52
		grid.add_child(button)

func _shop() -> void:
	var page := _panel_page("AVADANLIQ", "GÜCÜNÜ ARTIR · STİLİNİ SEÇ", true)
	var tabs := GridContainer.new()
	tabs.columns = 3 if compact else 5
	tabs.add_theme_constant_override("h_separation", 7)
	tabs.add_theme_constant_override("v_separation", 7)
	page.add_child(tabs)
	for entry in [{"id": "all", "text": "HAMISI"}, {"id": "power", "text": "GÜC"}, {"id": "speed", "text": "SÜRƏT"}, {"id": "clothing", "text": "GEYİM"}, {"id": "accessory", "text": "AKSESUAR"}]:
		var button := _button(entry.text, "filter:" + entry.id, func() -> void:
			filter = entry.id
			_rebuild(), "gold" if filter == entry.id else "blue")
		button.size_flags_horizontal = SIZE_EXPAND_FILL
		button.custom_minimum_size.y = 35
		button.add_theme_font_size_override("font_size", 9)
		tabs.add_child(button)
	for item in Metro.items:
		if filter != "all" and item.category != filter: continue
		var card := PanelContainer.new()
		card.add_theme_stylebox_override("panel", _panel_box(Color(0.06, 0.15, 0.20, 0.94), 12, Color("4b6d77")))
		page.add_child(card)
		var group := HBoxContainer.new()
		group.add_theme_constant_override("separation", 10)
		card.add_child(group)
		group.add_child(MetroIcon.new(item.icon, GOLD, 35))
		var text := VBoxContainer.new()
		text.size_flags_horizontal = SIZE_EXPAND_FILL
		text.add_theme_constant_override("separation", 5)
		group.add_child(text)
		text.add_child(_label(item.name, 14, CREAM))
		var effect := _label(item.effect, 10, AQUA)
		effect.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		effect.size_flags_horizontal = SIZE_EXPAND_FILL
		text.add_child(effect)
		if item.kind == "upgrade": text.add_child(_label("SƏVİYYƏ %d / %d" % [Metro.profile.upgrades[item.id], item.max_rank], 9, MUTED))
		var price := MetroRules.item_price(item, Metro.profile)
		var owned: bool = item.kind == "gear" and item.id in Metro.profile.owned
		var maxed: bool = item.kind == "upgrade" and Metro.profile.upgrades[item.id] >= item.max_rank
		var action := "AL\n%d" % price
		if owned: action = "ÇIXAR" if Metro.profile.equipped.get(item.slot) == item.id else "TAX"
		var button := _button(action, "buy:" + item.id, func() -> void:
			Metro.buy(item.id)
			call_deferred("_rebuild"), "gold" if not owned else "blue")
		button.disabled = maxed or (not owned and Metro.profile.coins < price)
		button.custom_minimum_size = Vector2(64, 54)
		button.add_theme_font_size_override("font_size", 10)
		group.add_child(button)

func _profile() -> void:
	var page := _panel_page("SƏRNİŞİNİM", MetroRules.rank_name(int(Metro.profile.xp)).to_upper(), true)
	var stats := GridContainer.new()
	stats.columns = 2
	stats.add_theme_constant_override("h_separation", 9)
	stats.add_theme_constant_override("v_separation", 9)
	page.add_child(stats)
	for entry in [["KEÇİLƏN QAPI", str(Metro.profile.total_doors)], ["STANSİYA", "%d / 27" % Metro.unique_stations()], ["TAP GÜCÜ", "%.1f" % Metro.player_stats().power], ["SÜRƏT", "×%.2f" % Metro.player_stats().speed]]:
		var label := _label(entry[0] + "\n" + entry[1], 13, CREAM)
		label.add_theme_stylebox_override("normal", _panel_box(Color(0.05, 0.14, 0.18, 0.92), 10, Color("58737a")))
		label.custom_minimum_size.y = 67
		label.size_flags_horizontal = SIZE_EXPAND_FILL
		stats.add_child(label)
	if Metro.profile.owned.is_empty():
		page.add_child(_label("Qapıları keç. Jeton qazan. İlk avadanlığını al.", 11, MUTED))
	for id in Metro.profile.owned:
		var item := Metro.item_by_id(id)
		var button := _button(item.name + ("  ✓" if Metro.profile.equipped.get(item.slot) == id else "  +"), "equip:" + id, func() -> void:
			Metro.equip(id)
			call_deferred("_rebuild"), "blue")
		page.add_child(button)
	page.add_child(_button("AVADANLIQ MAĞAZASI  →", "open-shop", func() -> void: _navigate("shop"), "gold"))

func _settings() -> void:
	var page := _panel_page("AYARLAR", "ÖZ RİTMİNİ SEÇ")
	for entry in [["sound", "OYUN SƏSLƏRİ"], ["haptics", "TOXUNUŞ HİSSİ"], ["reduced_motion", "SAKİT HƏRƏKƏT"]]:
		var id: String = entry[0]
		var enabled: bool = Metro.profile.settings[id]
		page.add_child(_button(entry[1] + ("   AÇIQ" if enabled else "   BAĞLI"), "setting:" + id, func() -> void:
			Metro.setting(id, not Metro.profile.settings[id])
			_rebuild(), "gold" if enabled else "blue"))
	page.add_child(_button("NECƏ OYNANIR?", "tutorial", _help, "blue"))
	page.add_child(_label("METRO SIMULATOR  1.1.0\nGodot 4 · Native 3D\nİrəliləyiş cihazda saxlanır.", 11, MUTED))

func _panel_page(title: String, subtitle: String, wardrobe: bool = false) -> VBoxContainer:
	var shade := ColorRect.new()
	_full(shade)
	shade.color = Color(0.025, 0.065, 0.09, 0.55 if wardrobe else 0.83)
	shade.mouse_filter = MOUSE_FILTER_IGNORE
	ui.add_child(shade)
	_top_wallet()
	var page_width := minf(720, logical_size.x - 30)
	var title_group := VBoxContainer.new()
	title_group.position = Vector2((logical_size.x - page_width) * 0.5, 62)
	title_group.add_theme_constant_override("separation", 4)
	ui.add_child(title_group)
	title_group.add_child(_display(title, 35, CREAM))
	title_group.add_child(_label(subtitle, 9, GOLD))
	var top: float = 128.0 if not wardrobe else (logical_size.y * 0.45 if not landscape else 130.0)
	var scroll := ScrollContainer.new()
	scroll.position = Vector2((logical_size.x - page_width) * 0.5, top)
	scroll.size = Vector2(page_width, logical_size.y - top - 72)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	ui.add_child(scroll)
	var column := VBoxContainer.new()
	column.size_flags_horizontal = SIZE_EXPAND_FILL
	column.add_theme_constant_override("separation", 12)
	scroll.add_child(column)
	_bottom_nav()
	return column

func _route_tabs() -> GridContainer:
	var tabs := GridContainer.new()
	tabs.columns = 2 if compact else 5
	tabs.add_theme_constant_override("h_separation", 8)
	tabs.add_theme_constant_override("v_separation", 8)
	for route in Metro.routes:
		var button := _button(route.name, "route:" + route.id, func() -> void:
			Metro.choose_route(route.id)
			_rebuild(), "gold" if route.id == Metro.selected_route else "blue")
		button.size_flags_horizontal = SIZE_EXPAND_FILL
		button.add_theme_font_size_override("font_size", 10)
		tabs.add_child(button)
	return tabs

func _game_overlay() -> void:
	if overlay == null: return
	for child in overlay.get_children():
		overlay.remove_child(child)
		child.queue_free()
	for id in ["next", "resume", "retry", "begin", "result-shop", "leave"]:
		controls.erase(id)
		handlers.erase(id)
	countdown_label = null
	var mode: String = Metro.session.mode
	if mode == "playing": return
	if mode == "countdown":
		var center := CenterContainer.new()
		_full(center)
		center.mouse_filter = MOUSE_FILTER_IGNORE
		overlay.add_child(center)
		countdown_label = _display("3", 108, GOLD)
		center.add_child(countdown_label)
		return
	var shade := ColorRect.new()
	_full(shade)
	shade.color = Color(0.015, 0.035, 0.06, 0.58)
	shade.mouse_filter = MOUSE_FILTER_IGNORE
	overlay.add_child(shade)
	var centre := CenterContainer.new()
	_full(centre)
	centre.mouse_filter = MOUSE_FILTER_IGNORE
	overlay.add_child(centre)
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _panel_box(Color("102b39"), 18, GOLD.darkened(0.18)))
	panel.custom_minimum_size.x = minf(345, logical_size.x - 48)
	centre.add_child(panel)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 12)
	panel.add_child(column)
	var headline := "HAZIRSAN?"
	var description := "Qapılar açılır. Ritmini tut."
	var text := "BAŞLA"
	var id := "begin"
	var callback := Callable(self, "_begin")
	if mode == "won":
		headline = "VAQONDASAN!" if Metro.session.door_index + 1 < Metro.session.doors_total else "STANSİYA KEÇİLDİ!"
		description = "+%d JETON  •  %.1f SANİYƏ" % [Metro.session.reward, Metro.session.time_left]
		text = "NÖVBƏTİ QAPI" if Metro.session.door_index + 1 < Metro.session.doors_total else "NÖVBƏTİ STANSİYA"
		id = "next"
		callback = Callable(self, "_next")
		var stars := _label("★   ".repeat(Metro.session.stars).strip_edges(), 27, GOLD)
		stars.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		column.add_child(stars)
	elif mode == "lost":
		headline = "QATAR GETDİ!"
		description = "Boş zolaqdan keç. Yenidən ritmi tut."
		text = "YENİDƏN CƏHD ET"
		id = "retry"
		callback = Callable(self, "_retry")
	elif mode == "paused":
		headline = "FASİLƏ"
		description = "Taymer dayanıb. Yol səni gözləyir."
		text = "DAVAM ET"
		id = "resume"
		callback = Callable(self, "_resume")
	var title := _display(headline, 36, CREAM)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(title)
	var copy := _label(description, 11, MUTED)
	copy.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(copy)
	column.add_child(_button(text, id, callback, "gold"))
	if mode in ["won", "lost"]: column.add_child(_button("AVADANLIQ AL  →", "result-shop", func() -> void: _navigate("shop"), "blue"))
	elif mode == "paused": column.add_child(_button("BAŞLANĞIC EKRANI", "leave", func() -> void: _navigate("home"), "blue"))

func _process(delta: float) -> void:
	if ui == null: return
	if view == "play" and not modal_open:
		Metro.session.tick(delta)
		for event in Metro.session.events:
			world.event(event)
			match event.type:
				"won":
					Metro.claim_win()
					audio.play("won")
				"clear": audio.play("time" if event.bonus > 0 else "clear")
				"go", "lost", "burst": audio.play(event.type)
		Metro.session.events.clear()
		_game_update()
	toast_left = maxf(0, toast_left - delta)
	if toast != null: toast.visible = toast_left > 0
	browser_elapsed += delta
	if browser_elapsed > 0.14:
		browser_elapsed = 0
		_browser_state()

func _game_update() -> void:
	if view != "play" or progress_bar == null: return
	var session: MetroSession = Metro.session
	progress_bar.value = session.progress() * 100
	energy_bar.value = session.energy
	combo_label.text = "KOMBO ×%d" % session.combo
	controls.tap.disabled = session.mode != "playing"
	controls.burst.disabled = session.mode != "playing" or session.energy < 60 or session.burst_cooldown > 0
	controls.burst.text = "YOL AÇ\n60" if session.burst_cooldown <= 0 else "%.1f s" % session.burst_cooldown
	var obstacle := session.active_obstacle()
	hint_label.text = "İZDİHAM DALĞASI! YOLUNU DƏYİŞ." if session.wave_active() else (obstacle.name.to_upper() if not obstacle.is_empty() else "VAQONA ÇATDIN!")
	if not obstacle.is_empty() and obstacle.time_bonus > 0: hint_label.text += "  +%.0f s" % obstacle.time_bonus
	if last_mode != session.mode:
		last_mode = session.mode
		_game_overlay()
	if countdown_label != null: countdown_label.text = str(maxi(1, int(ceil(session.countdown / 0.5))))

func _start_run() -> void:
	if not Metro.session.mode in ["paused", "won", "lost"]:
		Metro.prepare_station()
		Metro.session.start()
	view = "play"
	_rebuild()

func _begin() -> void:
	Metro.session.start()

func _tap() -> void:
	if view != "play": return
	if Metro.session.tap():
		audio.play("tap")
		_haptic(8)
		if tap_ring != null: tap_ring.impulse = 1.0

func _lane(lane: int) -> void:
	Metro.session.change_lane(lane)

func _burst() -> void:
	if Metro.session.burst(): _haptic(24)

func _haptic(duration: int) -> void:
	if not Metro.profile.settings.haptics: return
	if OS.has_feature("ios"): return
	if OS.has_feature("web"):
		JavaScriptBridge.eval("if(navigator.vibrate)navigator.vibrate(%d);" % duration)
	elif OS.has_feature("mobile"): Input.vibrate_handheld(duration)

func _pause() -> void:
	Metro.session.pause()

func _resume() -> void:
	Metro.session.stats = Metro.player_stats()
	Metro.session.resume()

func _retry() -> void:
	Metro.session.stats = Metro.player_stats()
	Metro.session.retry()
	world.last_door = -1
	world.update_station()

func _next() -> void:
	if Metro.session.door_index + 1 < Metro.session.doors_total:
		Metro.session.stats = Metro.player_stats()
		Metro.session.next_door()
	elif not Metro.advance_station(): view = "map"
	_rebuild()

func _navigate(id: String) -> void:
	if view == "play": Metro.session.pause()
	view = id
	audio.play("ui")
	_rebuild()

func _input(event: InputEvent) -> void:
	if view != "play" or modal_open or not event is InputEventKey or not event.pressed or event.echo: return
	match event.keycode:
		KEY_SPACE: _tap()
		KEY_A, KEY_LEFT: _lane(Metro.session.lane - 1)
		KEY_D, KEY_RIGHT: _lane(Metro.session.lane + 1)
		KEY_E: _burst()
		KEY_ESCAPE:
			if Metro.session.mode == "paused": _resume()
			else: _pause()
		_: return
	get_viewport().set_input_as_handled()

func _notification(what: int) -> void:
	if what in [NOTIFICATION_APPLICATION_FOCUS_OUT, NOTIFICATION_APPLICATION_PAUSED] and ui != null:
		Metro.session.pause()
		Metro.persist()

func _profile_changed() -> void:
	if coins_label != null: coins_label.text = str(Metro.profile.coins)

func _purchase_result(message: String, success: bool) -> void:
	call_deferred("_toast", message, success)

func _toast(message: String, success: bool = true) -> void:
	if toast == null: return
	toast.text = message
	toast.add_theme_color_override("font_color", AQUA if success else GOLD)
	toast_left = 2.5

func _help() -> void:
	modal_open = true
	var shade := ColorRect.new()
	_full(shade)
	shade.color = Color(0.015, 0.04, 0.06, 0.91)
	ui.add_child(shade)
	var center := CenterContainer.new()
	_full(center)
	shade.add_child(center)
	var panel := PanelContainer.new()
	panel.custom_minimum_size.x = minf(440, logical_size.x - 38)
	panel.add_theme_stylebox_override("panel", _panel_box(INK, 16, GOLD.darkened(0.2)))
	center.add_child(panel)
	var group := VBoxContainer.new()
	group.add_theme_constant_override("separation", 16)
	panel.add_child(group)
	group.add_child(_display("RİTMİ TUT!", 45, GOLD))
	var copy := _label("TAP düyməsinə təkrar toxun.\nSol / sağ ilə boş zolağı tut.\nSarı vaxt fürsətləri +1 / +2 saniyə verir.\n60 enerji → YOL AÇ → ×2.6 güc.\nQapıları keç → jeton qazan → avadanlıq al.", 13, CREAM)
	copy.custom_minimum_size.x = minf(390, logical_size.x - 78)
	copy.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	group.add_child(copy)
	group.add_child(_button("HAZIRAM", "close-help", func() -> void:
		modal_open = false
		ui.remove_child(shade)
		shade.queue_free(), "gold"))

func _browser_action(arguments: Array) -> void:
	if arguments.is_empty() or not arguments[0] is String: return
	var id: String = arguments[0]
	if not controls.has(id) or not handlers.has(id): return
	var button: Button = controls[id]
	if button.disabled or not button.is_visible_in_tree(): return
	handlers[id].call()

func _browser_state() -> void:
	if not OS.has_feature("web") or ui == null: return
	var buttons := {}
	for id in controls:
		var button: Button = controls[id]
		if not is_instance_valid(button) or not button.is_visible_in_tree(): continue
		if modal_open and id != "close-help": continue
		var rect := button.get_global_rect()
		buttons[id] = {"x": rect.position.x, "y": rect.position.y, "width": rect.size.x, "height": rect.size.y, "text": button.text if not button.text.is_empty() else button.tooltip_text, "disabled": button.disabled}
	var report := {
		"ready": world.world_ready, "engine": "Godot", "version": "1.1.0", "view": view, "world": world.snapshot(),
		"route": Metro.selected_route, "station": Metro.current_station().short, "coins": Metro.profile.coins,
		"xp": Metro.profile.xp, "doors_completed": Metro.profile.total_doors, "completed_stations": Metro.completed_stations(),
		"route_progress": Metro.profile.route_progress, "unique_stations": Metro.unique_stations(),
		"upgrades": Metro.profile.upgrades, "owned": Metro.profile.owned, "equipped": Metro.profile.equipped,
		"stats": Metro.player_stats(), "session": Metro.session.snapshot(), "buttons": buttons,
		"settings": Metro.profile.settings, "save_ok": Metro.save_ok, "modal": modal_open,
		"viewport": {"width": get_viewport_rect().size.x, "height": get_viewport_rect().size.y}
	}
	JavaScriptBridge.eval("window.__metroState=" + JSON.stringify(report) + ";if(window.metroAccessibility)window.metroAccessibility(window.__metroState);", true)

func _physical_acceptance() -> void:
	var report: Dictionary = await load("res://tests/device_acceptance.gd").new().run(self)
	print("METRO_DEVICE_ACCEPTANCE " + JSON.stringify({"checks": report.checks.size(), "failures": report.failures, "physical_device": report.physical_device}))

func _native_ready_receipt() -> void:
	await get_tree().create_timer(1.4).timeout
	var file := FileAccess.open("user://metro-runtime.json", FileAccess.WRITE)
	file.store_string(JSON.stringify({"at": Time.get_datetime_string_from_system(true), "version": "1.1.0", "build": "2", "main_scene_ready": true,
		"physical_device": true, "renderer": RenderingServer.get_current_rendering_method(), "driver": RenderingServer.get_current_rendering_driver_name(),
		"display_server": DisplayServer.get_name(), "ui_points": logical_size, "viewport": get_viewport_rect().size,
		"safe_area": DisplayServer.get_display_safe_area(), "world": world.snapshot()}))
	file.close()

func _button(text: String, id: String, callback: Callable, style: String = "blue") -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size.y = 45
	button.mouse_default_cursor_shape = CURSOR_POINTING_HAND
	button.add_theme_font_override("font", strong_font)
	button.add_theme_font_size_override("font_size", 13)
	var gold := style == "gold"
	for state in ["normal", "hover", "pressed", "disabled"]:
		var color := GOLD if gold else Color(0.07, 0.18, 0.23, 0.91)
		if state == "pressed": color = color.darkened(0.16)
		if state == "hover": color = color.lightened(0.06)
		if state == "disabled": color = Color(0.12, 0.23, 0.28, 0.73)
		var box := _panel_box(color, 11, Color("efd29b") if gold else Color("66838c"))
		box.shadow_color = Color(0.01, 0.025, 0.03, 0.62)
		box.shadow_size = 3
		box.shadow_offset = Vector2(0, 3)
		button.add_theme_stylebox_override(state, box)
	button.add_theme_stylebox_override("focus", MetroStyle.slim_box(Color(0, 0, 0, 0), 10))
	button.add_theme_color_override("font_color", INK if gold else CREAM)
	button.add_theme_color_override("font_hover_color", INK if gold else CREAM)
	button.add_theme_color_override("font_pressed_color", INK if gold else GOLD)
	button.add_theme_color_override("font_disabled_color", Color("667b80"))
	button.pressed.connect(callback)
	controls[id] = button
	handlers[id] = callback
	return button

func _icon_button(button: Button, icon: String, color: Color, icon_size: int) -> void:
	var center := CenterContainer.new()
	_full(center)
	center.mouse_filter = MOUSE_FILTER_IGNORE
	center.add_child(MetroIcon.new(icon, color, icon_size))
	button.add_child(center)

func _label(copy: String, font_size: int, color: Color) -> Label:
	var label := Label.new()
	label.text = copy
	label.add_theme_font_override("font", normal_font)
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.48))
	label.add_theme_constant_override("shadow_offset_y", 1)
	label.mouse_filter = MOUSE_FILTER_IGNORE
	return label

func _display(copy: String, font_size: int, color: Color) -> Label:
	var label := _label(copy, font_size, color)
	label.add_theme_font_override("font", display_font)
	return label

func _panel_box(color: Color, radius: int = 12, border: Color = BLUE) -> StyleBoxFlat:
	var box := MetroStyle.box(color, radius, border, 1)
	box.content_margin_left = 12
	box.content_margin_right = 12
	box.content_margin_top = 8
	box.content_margin_bottom = 8
	return box

func _bar(color: Color, height: int) -> ProgressBar:
	var bar := ProgressBar.new()
	bar.custom_minimum_size.y = height
	bar.show_percentage = false
	bar.mouse_filter = MOUSE_FILTER_IGNORE
	bar.add_theme_stylebox_override("background", MetroStyle.slim_box(Color(0.04, 0.12, 0.15, 0.72), 3))
	bar.add_theme_stylebox_override("fill", MetroStyle.slim_box(color, 3))
	return bar

func _spacer() -> Control:
	var spacer := Control.new()
	spacer.size_flags_horizontal = SIZE_EXPAND_FILL
	spacer.mouse_filter = MOUSE_FILTER_IGNORE
	return spacer

func _full(control: Control) -> void:
	control.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
