extends Control

var ui: Control
var shell: VBoxContainer
var content: Control
var overlay: Control
var toast: Label
var coins_label: Label
var audio: MetroAudio
var platform: MetroPlatform
var controls: Dictionary = {}
var handlers: Dictionary = {}
var view := "home"
var filter := "all"
var compact := false
var landscape := false
var logical_size := Vector2(1440, 900)
var display_font: Font
var normal_font: Font
var strong_font: Font
var last_mode := ""
var resize_pending := false
var time_label: Label
var obstacle_label: Label
var combo_label: Label
var energy_label: Label
var progress_bar: ProgressBar
var energy_bar: ProgressBar
var timer_bar: ProgressBar
var countdown_label: Label
var hint_label: Label
var toast_left := 0.0
var browser_elapsed := 0.0
var browser_callback: JavaScriptObject
var modal_open := false

func _ready() -> void:
	if "--self-test" in OS.get_cmdline_user_args():
		call_deferred("_run_tests")
		return
	var manrope: Font = load("res://assets/fonts/Manrope.ttf")
	var noto: Font = load("res://assets/fonts/NotoSans.ttf")
	var readable := FontVariation.new()
	readable.base_font = manrope
	readable.variation_opentype = {"wght": 600}
	readable.fallbacks = [noto, ThemeDB.fallback_font]
	normal_font = readable
	display_font = load("res://assets/fonts/BarlowCondensed-SemiBold.ttf")
	display_font.fallbacks = [noto, ThemeDB.fallback_font]
	var variation := FontVariation.new()
	variation.base_font = manrope
	variation.variation_opentype = {"wght": 750}
	variation.fallbacks = [noto, ThemeDB.fallback_font]
	strong_font = variation
	var game_theme := Theme.new()
	game_theme.default_font = normal_font
	game_theme.default_font_size = 14
	game_theme.set_stylebox("scroll", "VScrollBar", MetroStyle.slim_box(Color("18282b"), 3))
	game_theme.set_stylebox("grabber", "VScrollBar", MetroStyle.slim_box(Color("41544d"), 3))
	game_theme.set_stylebox("grabber_highlight", "VScrollBar", MetroStyle.slim_box(MetroStyle.LIME.darkened(0.3), 3))
	game_theme.set_stylebox("scroll_focus", "VScrollBar", MetroStyle.slim_box(Color("18282b"), 3))
	game_theme.set_stylebox("increment", "VScrollBar", StyleBoxEmpty.new())
	game_theme.set_stylebox("decrement", "VScrollBar", StyleBoxEmpty.new())
	game_theme.set_constant("scrollbar_width", "VScrollBar", 4)
	theme = game_theme
	ui = Control.new()
	add_child(ui)
	audio = MetroAudio.new()
	add_child(audio)
	get_viewport().size_changed.connect(_schedule_resize)
	Metro.profile_changed.connect(_profile_changed)
	Metro.purchase_result.connect(_purchase_message)
	if OS.has_feature("web"):
		browser_callback = JavaScriptBridge.create_callback(_browser_action)
		JavaScriptBridge.get_interface("window").metroAction = browser_callback
	_resize()
	print("METRO_READY | Godot 4 | Bakı · 27 stansiya")
	if OS.get_environment("METRO_DEVICE_ACCEPTANCE") == "1":
		call_deferred("_physical_acceptance")
	elif OS.has_feature("ios"):
		call_deferred("_native_ready_receipt")

func _run_tests() -> void:
	var report: Dictionary = load("res://tests/acceptance.gd").new().run(Metro)
	print("METRO_ACCEPTANCE " + JSON.stringify(report))
	get_tree().quit(0 if report.failures.is_empty() else 1)

func _physical_acceptance() -> void:
	var report: Dictionary = await load("res://tests/device_acceptance.gd").new().run(self)
	print("METRO_DEVICE_ACCEPTANCE " + JSON.stringify({"checks": report.checks.size(), "failures": report.failures, "physical_device": report.physical_device}))

func _native_ready_receipt() -> void:
	await get_tree().create_timer(1.0).timeout
	var rects := {}
	for id in controls:
		if is_instance_valid(controls[id]):
			var rect: Rect2 = controls[id].get_global_rect()
			rects[id] = {"x": rect.position.x, "y": rect.position.y, "width": rect.size.x, "height": rect.size.y}
	var report := {
		"at": Time.get_datetime_string_from_system(true), "version": "1.0.0", "build": "1",
		"physical_device": true, "engine": Engine.get_version_info().string,
		"renderer": RenderingServer.get_current_rendering_method(), "driver": RenderingServer.get_current_rendering_driver_name(),
		"display_server": DisplayServer.get_name(), "ui_points": logical_size,
		"viewport": get_viewport_rect().size, "safe_area": DisplayServer.get_display_safe_area(),
		"main_scene_ready": true, "view": view, "controls": rects
	}
	var file := FileAccess.open("user://metro-runtime.json", FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(report))
		file.close()

func _schedule_resize() -> void:
	if resize_pending or ui == null: return
	resize_pending = true
	call_deferred("_resize")

func _resize() -> void:
	resize_pending = false
	var available := get_viewport_rect().size
	var factor := minf(1.0, available.x / 390.0)
	ui.position = Vector2.ZERO
	if OS.has_feature("ios"):
		var safe := DisplayServer.get_display_safe_area()
		if safe.size.x > 0 and safe.size.y > 0:
			ui.position = Vector2(safe.position)
			available = Vector2(safe.size)
		factor = maxf(1, DisplayServer.screen_get_scale())
		factor *= minf(1, available.x / factor / 390.0)
	ui.scale = Vector2.ONE * factor
	logical_size = available / factor
	ui.size = logical_size
	landscape = logical_size.x > logical_size.y and logical_size.y < 620
	compact = logical_size.x < 920 or landscape
	_rebuild()

func _rebuild() -> void:
	if ui == null: return
	for child in ui.get_children():
		ui.remove_child(child)
		child.queue_free()
	controls.clear()
	handlers.clear()
	platform = null
	countdown_label = null
	time_label = null
	last_mode = ""
	modal_open = false
	var background := ColorRect.new()
	background.color = MetroStyle.BG
	_full(background)
	background.mouse_filter = MOUSE_FILTER_IGNORE
	ui.add_child(background)
	var margin := MetroStyle.margin(14 if compact or landscape else 26)
	_full(margin)
	ui.add_child(margin)
	shell = MetroStyle.vbox(14 if compact else 20)
	margin.add_child(shell)
	_build_header()
	var body := MetroStyle.hbox(24)
	body.size_flags_vertical = SIZE_EXPAND_FILL
	shell.add_child(body)
	if not compact and not landscape: _build_sidebar(body)
	content = Control.new()
	content.size_flags_horizontal = SIZE_EXPAND_FILL
	content.size_flags_vertical = SIZE_EXPAND_FILL
	body.add_child(content)
	_build_page()
	if compact and not (landscape and view == "play"): _build_bottom_nav()
	toast = MetroStyle.label("", 13, MetroStyle.TEXT)
	toast.add_theme_stylebox_override("normal", MetroStyle.box(Color("263b2b"), 12, MetroStyle.LIME.darkened(0.45), 1))
	toast.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	toast.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	toast.set_anchors_preset(PRESET_BOTTOM_WIDE)
	toast.offset_left = 20
	toast.offset_right = -20
	toast.offset_top = -112 if compact else -74
	toast.offset_bottom = -66 if compact else -26
	toast.visible = false
	toast.mouse_filter = MOUSE_FILTER_IGNORE
	ui.add_child(toast)
	_browser_state()

func _build_header() -> void:
	var header := MetroStyle.hbox(12)
	header.custom_minimum_size.y = 42 if landscape else (48 if compact else 58)
	shell.add_child(header)
	var logo_panel := MetroStyle.panel(MetroStyle.LIME, 11)
	logo_panel.add_theme_stylebox_override("panel", MetroStyle.box(MetroStyle.LIME, 11, MetroStyle.LIME, 0))
	logo_panel.custom_minimum_size = Vector2(43, 43) if compact else Vector2(48, 48)
	var logo := MetroIcon.new("metro", Color("172a1b"), 29)
	logo_panel.add_child(logo)
	header.add_child(logo_panel)
	var brand := MetroStyle.vbox(0)
	header.add_child(brand)
	var title := _display("METRO", 26 if compact else 31)
	brand.add_child(title)
	var subtitle := MetroStyle.label("S I M U L A T O R", 8 if compact else 9, MetroStyle.MUTED)
	brand.add_child(subtitle)
	if not compact and not landscape:
		var divider := ColorRect.new()
		divider.color = MetroStyle.BORDER
		divider.custom_minimum_size = Vector2(1, 30)
		divider.size_flags_vertical = SIZE_SHRINK_CENTER
		header.add_child(divider)
		header.add_child(MetroStyle.label("BAKI  /  HƏR TOXUNUŞ BİR ADDIMDIR", 10, MetroStyle.MUTED))
	header.add_child(MetroStyle.spacer())
	if not compact:
		var rank := MetroStyle.hbox(6)
		rank.add_child(MetroIcon.new("medal", MetroStyle.ORANGE, 20))
		rank.add_child(MetroStyle.label(MetroRules.rank_name(int(Metro.profile.xp)), 12, MetroStyle.MUTED))
		header.add_child(rank)
	var wallet := MetroStyle.panel(Color("1d2b23"), 12)
	var row := MetroStyle.hbox(8)
	wallet.add_child(row)
	row.add_child(MetroIcon.new("coin", MetroStyle.ORANGE, 22))
	coins_label = MetroStyle.label(_number(int(Metro.profile.coins)), 16, MetroStyle.TEXT)
	coins_label.add_theme_font_override("font", strong_font)
	row.add_child(coins_label)
	if not compact: row.add_child(MetroStyle.label("jeton", 11, MetroStyle.MUTED))
	header.add_child(wallet)
	if not compact:
		var help := _button("?", "help", _show_help, false, false, true)
		help.custom_minimum_size = Vector2(40, 40)
		header.add_child(help)
	elif landscape:
		header.add_child(_button("Menyu", "home", func() -> void: _navigate("home"), false, false, true))

func _build_sidebar(body: HBoxContainer) -> void:
	var sidebar := MetroStyle.vbox(9)
	sidebar.custom_minimum_size.x = 208
	body.add_child(sidebar)
	sidebar.add_child(MetroStyle.label("SƏNİN ŞƏHƏR RİTMİN", 9, MetroStyle.MUTED))
	for entry in _nav_items():
		sidebar.add_child(_nav_button(entry.id, entry.label, entry.icon, 54))
	var filler := Control.new()
	filler.size_flags_vertical = SIZE_EXPAND_FILL
	sidebar.add_child(filler)
	var commuter := MetroStyle.panel()
	var card := MetroStyle.vbox(8)
	commuter.add_child(card)
	var row := MetroStyle.hbox(8)
	row.add_child(MetroIcon.new("energy", MetroStyle.LIME, 19))
	row.add_child(MetroStyle.label("PİK SAAT KLUBU", 10, MetroStyle.LIME))
	card.add_child(row)
	card.add_child(_display(MetroRules.rank_name(int(Metro.profile.xp)).to_upper(), 22))
	card.add_child(MetroStyle.label("%d XP  ·  %d qapı keçilib" % [Metro.profile.xp, Metro.profile.total_doors], 11, MetroStyle.MUTED))
	var bar := _bar(MetroStyle.LIME)
	bar.value = int(Metro.profile.xp) % 400 / 4.0
	card.add_child(bar)
	card.add_child(_wrapped("Ritmi tut. Qapını keç. Şəhərin ustası ol.", 11, MetroStyle.MUTED))
	sidebar.add_child(commuter)
	var saved := MetroStyle.hbox(6)
	saved.add_child(MetroIcon.new("check", MetroStyle.MUTED, 15))
	saved.add_child(MetroStyle.label("İrəliləyiş cihazda saxlanır", 10, MetroStyle.MUTED))
	sidebar.add_child(saved)

func _build_bottom_nav() -> void:
	var panel := MetroStyle.panel(Color("101e20"), 14)
	panel.add_theme_stylebox_override("panel", MetroStyle.box(Color("101e20"), 14, MetroStyle.BORDER, 1))
	var row := MetroStyle.hbox(3)
	panel.add_child(row)
	for entry in _nav_items():
		var button := _nav_button(entry.id, entry.short, entry.icon, 45, true)
		button.size_flags_horizontal = SIZE_EXPAND_FILL
		row.add_child(button)
	shell.add_child(panel)

func _nav_items() -> Array:
	return [
		{"id": "home", "label": "Başlanğıc", "short": "Başla", "icon": "metro"},
		{"id": "map", "label": "Metro xəritəsi", "short": "Xəritə", "icon": "map"},
		{"id": "shop", "label": "Avadanlıq", "short": "Mağaza", "icon": "shop"},
		{"id": "profile", "label": "Mənim sərnişinim", "short": "Sərnişin", "icon": "person"},
		{"id": "settings", "label": "Ayarlar", "short": "Ayarlar", "icon": "settings"}
	]

func _nav_button(id: String, text: String, icon: String, height: int, bottom: bool = false) -> Button:
	var selected := view == id or (view == "play" and id == "home")
	var button := _button("", "nav:" + id, func() -> void: _navigate(id), false, selected, true)
	button.custom_minimum_size.y = height
	var row: Container = MetroStyle.vbox(3) if bottom else MetroStyle.hbox(12)
	_full(row)
	row.offset_left = 0 if bottom else 15
	row.offset_right = 0 if bottom else -12
	row.mouse_filter = MOUSE_FILTER_IGNORE
	if bottom:
		row.alignment = BoxContainer.ALIGNMENT_CENTER
	var glyph := MetroIcon.new(icon, MetroStyle.LIME if selected else MetroStyle.MUTED, 20)
	glyph.size_flags_horizontal = SIZE_SHRINK_CENTER if bottom else SIZE_SHRINK_BEGIN
	row.add_child(glyph)
	var label := MetroStyle.label(text, 9 if bottom else 13, MetroStyle.LIME if selected else MetroStyle.MUTED)
	label.size_flags_vertical = SIZE_SHRINK_CENTER
	if bottom: label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	row.add_child(label)
	button.add_child(row)
	button.tooltip_text = text
	return button

func _build_page() -> void:
	match view:
		"home": _home()
		"map": _map()
		"shop": _shop()
		"profile": _profile()
		"settings": _settings()
		"play": _play()

func _page(gap: int = 20, scrollable: bool = true) -> VBoxContainer:
	var parent: Control = content
	if scrollable:
		var scroll := ScrollContainer.new()
		_full(scroll)
		scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
		scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_AUTO
		content.add_child(scroll)
		parent = scroll
	var column := MetroStyle.vbox(gap)
	column.size_flags_horizontal = SIZE_EXPAND_FILL
	if not scrollable: _full(column)
	parent.add_child(column)
	return column

func _heading(page: VBoxContainer, eyebrow: String, headline: String, subtitle: String) -> void:
	var group := MetroStyle.vbox(5)
	page.add_child(group)
	group.add_child(MetroStyle.label(eyebrow, 10, MetroStyle.LIME))
	group.add_child(_display(headline, 40 if compact else 54))
	if not subtitle.is_empty(): group.add_child(_wrapped(subtitle, 13, MetroStyle.MUTED))

func _home() -> void:
	var page := _page(14 if compact else 20)
	var top := MetroStyle.hbox(10)
	top.add_child(MetroStyle.label("BAKI  /  PİK SAAT", 10, MetroStyle.LIME))
	top.add_child(MetroStyle.spacer())
	top.add_child(MetroStyle.label("08:47  ·  ŞƏHƏR OYAQDIR", 10, MetroStyle.MUTED))
	page.add_child(top)
	var heading := MetroStyle.hbox(18)
	page.add_child(heading)
	var head := _display("BAKI SƏNİ\nGÖZLƏMİR.", 47 if compact else 68)
	head.size_flags_horizontal = SIZE_EXPAND_FILL
	heading.add_child(head)
	if not compact:
		var introduction := MetroStyle.vbox(8)
		introduction.custom_minimum_size.x = 320
		introduction.size_flags_vertical = SIZE_SHRINK_CENTER
		heading.add_child(introduction)
		introduction.add_child(_wrapped("Qapılar bağlanır. İzdiham sıxdır.\nSənin isə bir neçə saniyən var.", 16, MetroStyle.TEXT))
		introduction.add_child(MetroStyle.label("TAP et. Yolunu aç. Vaqona çat.", 12, MetroStyle.MUTED))
	var hero: BoxContainer = MetroStyle.vbox(16) if compact else MetroStyle.hbox(20)
	page.add_child(hero)
	var run := MetroStyle.panel(Color("12221f"), 20)
	run.size_flags_horizontal = SIZE_EXPAND_FILL
	if not compact: run.size_flags_stretch_ratio = 0.85
	hero.add_child(run)
	var left := MetroStyle.vbox(10 if compact else 15)
	run.add_child(left)
	var route := Metro.current_route()
	var station := Metro.current_station()
	var row := MetroStyle.hbox(8)
	row.add_child(MetroIcon.new("map", Color(route.color), 19))
	row.add_child(MetroStyle.label(route.line, 10, Color(route.color)))
	row.add_child(MetroStyle.spacer())
	row.add_child(MetroStyle.label("%02d / %02d" % [Metro.selected_station + 1, route.stations.size()], 11, MetroStyle.MUTED))
	left.add_child(row)
	if not compact: left.add_child(MetroStyle.label("NÖVBƏTİ DAYANACAQ", 9, MetroStyle.MUTED))
	left.add_child(_display(station.short.to_upper(), 37 if compact else 43))
	left.add_child(_wrapped(station.mood, 12, MetroStyle.MUTED))
	var progress := MetroStyle.hbox(4)
	left.add_child(progress)
	for index in range(route.stations.size()):
		var tick := ColorRect.new()
		tick.color = Color(route.color) if index <= Metro.selected_station else Color("30443a")
		tick.custom_minimum_size = Vector2(1, 4)
		tick.size_flags_horizontal = SIZE_EXPAND_FILL
		progress.add_child(tick)
	var stats := MetroStyle.hbox(12)
	stats.add_child(_stat("power", "TAP GÜCÜ", "%.1f" % Metro.player_stats().power, MetroStyle.ORANGE))
	stats.add_child(_stat("speed", "SÜRƏT", "×%.2f" % Metro.player_stats().speed, MetroStyle.LIME))
	stats.add_child(_stat("time", "QAPI TAYMERİ", "%.1f s" % Metro.session.initial_time, Color("8fcbd2")))
	left.add_child(stats)
	var start := _button("QATARA ÇAT   →", "start", _start_run, true)
	if Metro.session.mode in ["paused", "won", "lost"]: start.text = "OYUNA DAVAM ET   →"
	start.custom_minimum_size.y = 62
	start.add_theme_font_override("font", strong_font)
	left.add_child(start)
	var note := MetroStyle.hbox(7)
	note.add_child(MetroIcon.new("time", MetroStyle.ORANGE, 16))
	note.add_child(_wrapped("Vaxt fürsətlərini aş: +1 və +2 saniyə qazan.", 11, MetroStyle.MUTED))
	left.add_child(note)
	var scene_panel := MetroStyle.panel(Color("152924"), 20)
	scene_panel.size_flags_horizontal = SIZE_EXPAND_FILL
	scene_panel.add_theme_stylebox_override("panel", MetroStyle.box(Color("152924"), 20, Color("344d3b"), 1))
	hero.add_child(scene_panel)
	var scene_column := MetroStyle.vbox(8)
	scene_panel.add_child(scene_column)
	var stage_header := MetroStyle.hbox(8)
	stage_header.add_child(MetroStyle.label("PLATFORMA 01", 10, MetroStyle.LIME))
	stage_header.add_child(MetroStyle.spacer())
	stage_header.add_child(MetroStyle.label("QATAR GƏLİR", 9, MetroStyle.MUTED))
	scene_column.add_child(stage_header)
	var preview := MetroPlatform.new(true)
	preview.custom_minimum_size = Vector2(240, 170 if compact else 290)
	preview.size_flags_vertical = SIZE_EXPAND_FILL
	scene_column.add_child(preview)
	var stage_footer := MetroStyle.hbox(8)
	stage_footer.add_child(MetroIcon.new("tap", MetroStyle.LIME, 19))
	stage_footer.add_child(MetroStyle.label("Hər toxunuş bir addımdır.", 11, MetroStyle.TEXT))
	stage_footer.add_child(MetroStyle.spacer())
	stage_footer.add_child(MetroStyle.label("GODOT ENGINE", 8, MetroStyle.MUTED))
	scene_column.add_child(stage_footer)
	var journey_header := MetroStyle.hbox(8)
	journey_header.add_child(MetroStyle.label("MARŞRUTUNU SEÇ", 10, MetroStyle.MUTED))
	journey_header.add_child(MetroStyle.spacer())
	journey_header.add_child(_button("27 stansiya · xəritə →", "open-map", func() -> void: _navigate("map"), false, false, true))
	page.add_child(journey_header)
	var route_cards := GridContainer.new()
	route_cards.columns = 1 if compact else 3
	route_cards.add_theme_constant_override("h_separation", 14)
	route_cards.add_theme_constant_override("v_separation", 10)
	page.add_child(route_cards)
	for id in ["green", "red", "purple"]:
		route_cards.add_child(_route_card(Metro.route_by_id(id)))
	var tips := MetroStyle.hbox(8)
	tips.add_child(_button("Necə oynanır?", "tutorial", _show_help, false, false, true))
	tips.add_child(_wrapped("Qapıları keç, jeton qazan, sərnişinini gücləndir.", 11, MetroStyle.MUTED))
	page.add_child(tips)

func _route_card(route: Dictionary) -> Button:
	var button := _button("", "route:" + route.id, func() -> void:
		Metro.choose_route(route.id)
		_rebuild(), false, Metro.selected_route == route.id)
	button.custom_minimum_size = Vector2(150, 112)
	button.tooltip_text = route.name + " · " + route.from + " → " + route.to
	button.size_flags_horizontal = SIZE_EXPAND_FILL
	var margin := MetroStyle.margin(14)
	_full(margin)
	margin.mouse_filter = MOUSE_FILTER_IGNORE
	button.add_child(margin)
	var column := MetroStyle.vbox(8)
	column.mouse_filter = MOUSE_FILTER_IGNORE
	margin.add_child(column)
	var top := MetroStyle.hbox(6)
	top.add_child(MetroIcon.new("metro", Color(route.color), 17))
	top.add_child(MetroStyle.label(route.line, 9, Color(route.color)))
	top.add_child(MetroStyle.spacer())
	top.add_child(MetroStyle.label("%d st." % route.stations.size(), 10, MetroStyle.MUTED))
	column.add_child(top)
	column.add_child(MetroStyle.label(route.from + " → " + route.to, 12, MetroStyle.TEXT))
	var bottom := MetroStyle.hbox(6)
	bottom.add_child(MetroStyle.label(route.subtitle, 10, MetroStyle.MUTED))
	bottom.add_child(MetroStyle.spacer())
	bottom.add_child(MetroIcon.new("arrow", Color(route.color), 14))
	column.add_child(bottom)
	return button

func _map() -> void:
	var page := _page(18)
	_heading(page, "27 STANSİYA  /  5 MARŞRUT", "ŞƏHƏR SƏNİNDİR.", "Hər stansiyada üç qapı. Final dayanacaqlarda dörd qapılı böyük sınaq.")
	page.add_child(_route_tabs())
	var route := Metro.current_route()
	var panel := MetroStyle.panel()
	page.add_child(panel)
	var group := MetroStyle.vbox(10)
	panel.add_child(group)
	var top := MetroStyle.hbox(8)
	top.add_child(MetroStyle.label(route.from + "  →  " + route.to, 14, Color(route.color)))
	top.add_child(MetroStyle.spacer())
	top.add_child(MetroStyle.label("%d / %d keçilib" % [Metro.completed_stations(route.id), route.stations.size()], 10, MetroStyle.MUTED))
	group.add_child(top)
	var diagram := MetroMapDiagram.new(route.id, compact)
	var rows := int(ceil(float(route.stations.size()) / (3 if compact else 6)))
	diagram.custom_minimum_size.y = 82 + maxi(0, rows - 1) * (70 if compact else 65)
	group.add_child(diagram)
	var grid := GridContainer.new()
	grid.columns = 1 if compact else (2 if logical_size.x < 1240 else 3)
	grid.add_theme_constant_override("h_separation", 12)
	grid.add_theme_constant_override("v_separation", 10)
	page.add_child(grid)
	for index in range(route.stations.size()):
		grid.add_child(_station_card(index))
	page.add_child(_wrapped("Stansiya ardıcıllığı: Bakı Metropoliteni. Bu, klassik marşrutlarla qurulmuş oyun kampaniyasıdır.", 10, MetroStyle.MUTED))

func _route_tabs() -> GridContainer:
	var tabs := GridContainer.new()
	tabs.columns = 2 if compact else 5
	tabs.add_theme_constant_override("h_separation", 8)
	tabs.add_theme_constant_override("v_separation", 8)
	for route in Metro.routes:
		var button := _button(route.name, "route:" + route.id, func() -> void:
			Metro.choose_route(route.id)
			_rebuild(), false, Metro.selected_route == route.id, true)
		button.size_flags_horizontal = SIZE_EXPAND_FILL
		tabs.add_child(button)
	return tabs

func _station_card(index: int) -> Button:
	var route := Metro.current_route()
	var station := Metro.station_by_id(route.stations[index])
	var open := index <= int(Metro.profile.route_progress[route.id])
	var result: Dictionary = Metro.profile.station_results.get(route.id + ":" + station.id, {})
	var button := _button("", "station:" + str(index), func() -> void:
		if Metro.choose_station(index):
			view = "play"
			Metro.session.start()
			_rebuild(), false, index == Metro.selected_station)
	button.custom_minimum_size = Vector2(190, 89)
	button.size_flags_horizontal = SIZE_EXPAND_FILL
	button.disabled = not open
	var margin := MetroStyle.margin(12)
	_full(margin)
	margin.mouse_filter = MOUSE_FILTER_IGNORE
	button.add_child(margin)
	var row := MetroStyle.hbox(10)
	margin.add_child(row)
	var number := _display("%02d" % (index + 1), 28, Color(route.color) if open else Color("4d6261"))
	number.size_flags_vertical = SIZE_SHRINK_CENTER
	row.add_child(number)
	var column := MetroStyle.vbox(7)
	column.size_flags_horizontal = SIZE_EXPAND_FILL
	row.add_child(column)
	column.add_child(MetroStyle.label(station.short, 12, MetroStyle.TEXT if open else MetroStyle.MUTED))
	var bottom := MetroStyle.hbox(6)
	var duration := MetroRules.door_duration(index + int(route.difficulty_offset), 0, float(Metro.player_stats().time))
	bottom.add_child(MetroStyle.label("%d qapı  ·  %.1f s" % [MetroRules.door_count(route, index), duration], 10, MetroStyle.MUTED))
	bottom.add_child(MetroStyle.spacer())
	if not result.is_empty(): bottom.add_child(MetroStyle.label("★".repeat(int(result.stars)), 11, MetroStyle.ORANGE))
	column.add_child(bottom)
	var glyph := MetroIcon.new("play" if open else "lock", Color(route.color) if open else MetroStyle.MUTED, 18)
	glyph.size_flags_vertical = SIZE_SHRINK_CENTER
	row.add_child(glyph)
	button.tooltip_text = station.name + (" · Oyna" if open else " · Əvvəlki stansiyanı tamamla")
	return button

func _shop() -> void:
	var page := _page(18)
	_heading(page, "JETONLARINI GÜCƏ ÇEVİR", "TEMPO ƏLAVƏ ET.", "Daha güclü TAP. Daha çevik addım. Öz Bakı stilin.")
	var tabs := GridContainer.new()
	tabs.columns = 3 if compact else 5
	tabs.add_theme_constant_override("h_separation", 8)
	tabs.add_theme_constant_override("v_separation", 8)
	page.add_child(tabs)
	for entry in [{"id": "all", "name": "Hamısı"}, {"id": "power", "name": "Güc"}, {"id": "speed", "name": "Sürət"}, {"id": "clothing", "name": "Geyim"}, {"id": "accessory", "name": "Aksesuar"}]:
		var tab := _button(entry.name, "filter:" + entry.id, func() -> void:
			filter = entry.id
			_rebuild(), false, filter == entry.id, true)
		tab.size_flags_horizontal = SIZE_EXPAND_FILL
		tabs.add_child(tab)
	var body: BoxContainer = MetroStyle.vbox(16) if compact else MetroStyle.hbox(18)
	page.add_child(body)
	var wardrobe_panel := MetroStyle.panel(Color("13241e"))
	if not compact: wardrobe_panel.custom_minimum_size.x = 212
	body.add_child(wardrobe_panel)
	var wardrobe_group: BoxContainer = MetroStyle.hbox(12) if compact else MetroStyle.vbox(12)
	wardrobe_panel.add_child(wardrobe_group)
	var wardrobe := MetroWardrobe.new(compact)
	if compact: wardrobe.custom_minimum_size = Vector2(100, 155)
	wardrobe_group.add_child(wardrobe)
	var equipment := MetroStyle.vbox(10)
	equipment.size_flags_horizontal = SIZE_EXPAND_FILL
	wardrobe_group.add_child(equipment)
	equipment.add_child(MetroStyle.label("SƏNİN SƏRNİŞİNİN", 10, MetroStyle.LIME))
	equipment.add_child(_stat("power", "TAP GÜCÜ", "%.1f" % Metro.player_stats().power, MetroStyle.ORANGE))
	equipment.add_child(_stat("speed", "ADDIM SÜRƏTİ", "×%.2f" % Metro.player_stats().speed, MetroStyle.LIME))
	equipment.add_child(_wrapped("Aldığın geyim və aksesuarlar personajında görünür.", 10, MetroStyle.MUTED))
	var grid := GridContainer.new()
	grid.columns = 1 if compact else (2 if logical_size.x < 1480 else 3)
	grid.size_flags_horizontal = SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation", 14)
	grid.add_theme_constant_override("v_separation", 14)
	body.add_child(grid)
	for item in Metro.items:
		if filter == "all" or item.category == filter: grid.add_child(_shop_card(item))

func _shop_card(item: Dictionary) -> PanelContainer:
	var panel := MetroStyle.panel()
	panel.size_flags_horizontal = SIZE_EXPAND_FILL
	var card := MetroStyle.vbox(10)
	panel.add_child(card)
	var top := MetroStyle.hbox(10)
	var glyph_panel := MetroStyle.panel(Color("24332c"), 12)
	glyph_panel.custom_minimum_size = Vector2(52, 52)
	glyph_panel.add_child(MetroIcon.new(item.icon, Color(item.color), 32))
	top.add_child(glyph_panel)
	var titles := MetroStyle.vbox(5)
	titles.size_flags_horizontal = SIZE_EXPAND_FILL
	top.add_child(titles)
	titles.add_child(MetroStyle.label(item.name, 15, MetroStyle.TEXT))
	var detail := "AVADANLIQ" if item.kind == "gear" else "%d / %d SƏVİYYƏ" % [Metro.profile.upgrades[item.id], item.max_rank]
	if item.kind == "gear" and item.id in Metro.profile.owned: detail = "TAXILIB" if Metro.profile.equipped.get(item.slot) == item.id else "SƏNİNDİR"
	titles.add_child(MetroStyle.label(detail, 9, Color(item.color)))
	card.add_child(top)
	var description := _wrapped(item.description, 12, MetroStyle.MUTED)
	description.custom_minimum_size.y = 42
	card.add_child(description)
	var effect := _wrapped(item.effect, 11, Color(item.color))
	effect.custom_minimum_size.y = 32
	card.add_child(effect)
	var price := MetroRules.item_price(item, Metro.profile)
	var owned: bool = item.kind == "gear" and item.id in Metro.profile.owned
	var maxed: bool = item.kind == "upgrade" and int(Metro.profile.upgrades[item.id]) >= int(item.max_rank)
	var text := "AL  ·  %d JETON" % price
	if owned: text = "ÇIXAR" if Metro.profile.equipped.get(item.slot) == item.id else "TAX"
	if maxed: text = "MAKSİMUM SƏVİYYƏ"
	var button := _button(text, "buy:" + item.id, func() -> void:
		Metro.buy(item.id)
		call_deferred("_rebuild"), not owned and int(Metro.profile.coins) >= price and not maxed, owned)
	button.disabled = maxed or (not owned and int(Metro.profile.coins) < price)
	card.add_child(button)
	return panel

func _profile() -> void:
	var page := _page(18)
	_heading(page, "HƏR QAPI BİR HEKAYƏDİR", "SƏNİN ŞƏHƏR STİLİN.", "Avadanlığını tax, rekordlarını gör, bütün xətlərin ustası ol.")
	var hero: BoxContainer = MetroStyle.vbox(14) if compact else MetroStyle.hbox(18)
	page.add_child(hero)
	var portrait := MetroStyle.panel(Color("15251f"))
	portrait.custom_minimum_size.x = 250 if not compact else 0
	hero.add_child(portrait)
	var portrait_group := MetroStyle.vbox(8)
	portrait.add_child(portrait_group)
	portrait_group.add_child(MetroWardrobe.new())
	var rank := _display(MetroRules.rank_name(int(Metro.profile.xp)).to_upper(), 28)
	rank.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	portrait_group.add_child(rank)
	var info := MetroStyle.vbox(16)
	info.size_flags_horizontal = SIZE_EXPAND_FILL
	hero.add_child(info)
	var stats := GridContainer.new()
	stats.columns = 2
	stats.add_theme_constant_override("h_separation", 12)
	stats.add_theme_constant_override("v_separation", 12)
	info.add_child(stats)
	for entry in [
		{"icon": "metro", "title": "KEÇİLƏN QAPILAR", "value": str(Metro.profile.total_doors)},
		{"icon": "map", "title": "STANSİYALAR", "value": "%d / 27" % Metro.unique_stations()},
		{"icon": "tap", "title": "ƏN YAXŞI KOMBO", "value": "×%d" % Metro.profile.best_combo},
		{"icon": "medal", "title": "TOPLANAN XP", "value": _number(int(Metro.profile.xp))}
	]:
		var stat := _stat(entry.icon, entry.title, entry.value, MetroStyle.LIME)
		stat.custom_minimum_size.y = 95
		stats.add_child(stat)
	var equipment_panel := MetroStyle.panel()
	info.add_child(equipment_panel)
	var equipment := MetroStyle.vbox(12)
	equipment_panel.add_child(equipment)
	equipment.add_child(MetroStyle.label("QARDEROBUN", 10, MetroStyle.LIME))
	if Metro.profile.owned.is_empty():
		equipment.add_child(_wrapped("İlk qapıları keç və öz ilk avadanlığını al. Güc və görünüş birlikdə dəyişir.", 13, MetroStyle.MUTED))
	else:
		var grid := GridContainer.new()
		grid.columns = 2
		grid.add_theme_constant_override("h_separation", 8)
		grid.add_theme_constant_override("v_separation", 8)
		equipment.add_child(grid)
		for id in Metro.profile.owned:
			var item := Metro.item_by_id(id)
			var button := _button(item.name + ("  ✓" if Metro.profile.equipped.get(item.slot) == id else ""), "equip:" + id, func() -> void:
				Metro.equip(id)
				call_deferred("_rebuild"), false, Metro.profile.equipped.get(item.slot) == id, true)
			button.size_flags_horizontal = SIZE_EXPAND_FILL
			grid.add_child(button)
		equipment.add_child(_wrapped("Kask və qulaqlıq eyni baş slotundadır. İstədiyini seç.", 10, MetroStyle.MUTED))
	equipment.add_child(_button("AVADANLIQ MAĞAZASI  →", "open-shop", func() -> void: _navigate("shop"), true))
	page.add_child(MetroStyle.label("MARŞRUT NİŞANLARI", 10, MetroStyle.MUTED))
	var medals := GridContainer.new()
	medals.columns = 1 if compact else 3
	medals.add_theme_constant_override("h_separation", 12)
	medals.add_theme_constant_override("v_separation", 12)
	page.add_child(medals)
	for route in Metro.routes:
		var medal := MetroStyle.panel()
		medal.size_flags_horizontal = SIZE_EXPAND_FILL
		var group := MetroStyle.hbox(12)
		medal.add_child(group)
		group.add_child(MetroIcon.new("cup", Color(route.color) if route.id in Metro.profile.route_medals else Color("50635d"), 34))
		var labels := MetroStyle.vbox(6)
		labels.add_child(MetroStyle.label(route.name, 12))
		labels.add_child(MetroStyle.label("Usta nişanı qazanılıb" if route.id in Metro.profile.route_medals else "%d / %d stansiya" % [Metro.completed_stations(route.id), route.stations.size()], 10, MetroStyle.MUTED))
		group.add_child(labels)
		medals.add_child(medal)

func _settings() -> void:
	var page := _page(18)
	_heading(page, "OYUN SƏNİN RİTMİNDƏ", "ÖZÜNƏ UYĞUNLAŞDIR.", "Səs, toxunuş hissi və animasiya seçimləri cihazda saxlanır.")
	for entry in [
		{"id": "sound", "name": "Oyun səsləri", "description": "TAP, qapı, vaxt bonusu və metro ritmi.", "icon": "sound"},
		{"id": "haptics", "name": "Toxunuş hissi", "description": "Dəstəkləyən cihazlarda qısa vibrasiya.", "icon": "tap"},
		{"id": "reduced_motion", "name": "Sakit animasiyalar", "description": "Hissəcikləri və əlavə səhnə hərəkətini azalt.", "icon": "person"}
	]:
		var panel := MetroStyle.panel()
		page.add_child(panel)
		var row := MetroStyle.hbox(12)
		panel.add_child(row)
		var icon := MetroIcon.new(entry.icon, MetroStyle.LIME, 27)
		icon.size_flags_vertical = SIZE_SHRINK_CENTER
		row.add_child(icon)
		var descriptions := MetroStyle.vbox(6)
		descriptions.size_flags_horizontal = SIZE_EXPAND_FILL
		row.add_child(descriptions)
		descriptions.add_child(MetroStyle.label(entry.name, 15))
		descriptions.add_child(_wrapped(entry.description, 11, MetroStyle.MUTED))
		var enabled: bool = Metro.profile.settings[entry.id]
		row.add_child(_button("AÇIQ" if enabled else "BAĞLI", "setting:" + entry.id, func() -> void:
			Metro.setting(entry.id, not Metro.profile.settings[entry.id])
			_rebuild(), false, enabled, true))
	var help := MetroStyle.panel()
	var group := MetroStyle.vbox(12)
	help.add_child(group)
	group.add_child(MetroStyle.label("İDARƏETMƏ", 10, MetroStyle.LIME))
	group.add_child(_wrapped("Telefon: TAP düyməsi, zolaq seçimi, Yol aç bacarığı.\nKlaviatura: SPACE — TAP  ·  A/D və ←/→ — zolaq  ·  E — Yol aç  ·  ESC — fasilə.", 13, MetroStyle.MUTED))
	group.add_child(_button("OYUN BƏLƏDÇİSİ  →", "tutorial", _show_help, false))
	page.add_child(help)
	var save := MetroStyle.panel()
	var save_group := MetroStyle.vbox(10)
	save.add_child(save_group)
	save_group.add_child(MetroStyle.label("METRO SIMULATOR  ·  1.0.0", 10, MetroStyle.LIME))
	save_group.add_child(_wrapped("27 stansiya, 5 marşrut, 37 stansiya mərhələsi. Jetonlar, avadanlıq, rekordlar və açılan dayanacaqlar avtomatik saxlanır. Hər stansiyanı yenidən oynamaq olar.", 12, MetroStyle.MUTED))
	save_group.add_child(_wrapped("Godot 4 · Bakı üçün hazırlanıb.\n" + ("Lokal yaddaş hazırdır." if Metro.save_ok else "Yaddaş yazıla bilmədi. Cihazda boş yer yoxla."), 11, MetroStyle.MUTED))
	page.add_child(save)

func _play() -> void:
	var page := _page(10, false)
	var route := Metro.current_route()
	var station := Metro.current_station()
	var heading := MetroStyle.hbox(8)
	page.add_child(heading)
	var titles := MetroStyle.vbox(3)
	titles.size_flags_horizontal = SIZE_EXPAND_FILL
	titles.add_child(MetroStyle.label(route.line + "  /  %02d" % (Metro.selected_station + 1), 9, Color(route.color)))
	titles.add_child(_display(station.short.to_upper(), 26 if compact or landscape else 37))
	heading.add_child(titles)
	for door in range(Metro.session.doors_total):
		var badge := MetroStyle.label(str(door + 1), 11, MetroStyle.LIME if door <= Metro.session.door_index else MetroStyle.MUTED)
		badge.add_theme_stylebox_override("normal", MetroStyle.box(MetroStyle.LIME_DARK if door <= Metro.session.door_index else MetroStyle.PANEL, 8, MetroStyle.BORDER, 1))
		badge.custom_minimum_size = Vector2(25 if compact else 32, 29)
		badge.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		badge.size_flags_vertical = SIZE_SHRINK_CENTER
		heading.add_child(badge)
	var pause := _button("", "pause", _pause, false, false, true)
	pause.custom_minimum_size.x = 36
	pause.action_mode = BaseButton.ACTION_MODE_BUTTON_PRESS
	pause.tooltip_text = "Fasilə · ESC"
	var pause_icon := MetroIcon.new("pause", MetroStyle.MUTED, 17)
	_full(pause_icon)
	pause_icon.offset_left = 9
	pause_icon.offset_right = -9
	pause_icon.offset_top = 10
	pause_icon.offset_bottom = -10
	pause.add_child(pause_icon)
	heading.add_child(pause)
	if landscape:
		var row := MetroStyle.hbox(14)
		row.size_flags_vertical = SIZE_EXPAND_FILL
		page.add_child(row)
		_stage(row, 140)
		var action_column := MetroStyle.vbox(9)
		action_column.custom_minimum_size.x = 288
		row.add_child(action_column)
		_game_hud(action_column)
		_game_controls(action_column, true)
	else:
		_game_hud(page)
		var row := MetroStyle.hbox(16)
		row.size_flags_vertical = SIZE_EXPAND_FILL
		page.add_child(row)
		_stage(row, 185 if compact else 220)
		if not compact: _game_info(row)
		_game_controls(page)
	_update_game()

func _game_hud(parent: VBoxContainer) -> void:
	var row := MetroStyle.hbox(8)
	parent.add_child(row)
	var timer := MetroStyle.panel(Color("20281f"), 12)
	timer.size_flags_horizontal = SIZE_EXPAND_FILL
	row.add_child(timer)
	var column := MetroStyle.vbox(2)
	timer.add_child(column)
	column.add_child(MetroStyle.label("QAPILAR BAĞLANIR", 8, MetroStyle.ORANGE))
	time_label = _display("9.5 s", 29 if compact or landscape else 38, MetroStyle.ORANGE)
	column.add_child(time_label)
	timer_bar = _bar(MetroStyle.ORANGE, 3)
	column.add_child(timer_bar)
	var mission := MetroStyle.panel(MetroStyle.PANEL, 12)
	mission.size_flags_horizontal = SIZE_EXPAND_FILL
	mission.size_flags_stretch_ratio = 1.3 if compact else 2.0
	row.add_child(mission)
	var mission_column := MetroStyle.vbox(5)
	mission.add_child(mission_column)
	mission_column.add_child(MetroStyle.label("VAQONA QƏDƏR", 8, MetroStyle.MUTED))
	obstacle_label = MetroStyle.label("0 / 5 maneə", 12 if compact else 16)
	mission_column.add_child(obstacle_label)
	progress_bar = _bar(MetroStyle.LIME, 5)
	mission_column.add_child(progress_bar)
	var combo := MetroStyle.panel(MetroStyle.PANEL, 12)
	combo.size_flags_horizontal = SIZE_EXPAND_FILL
	row.add_child(combo)
	var combo_column := MetroStyle.vbox(1)
	combo.add_child(combo_column)
	combo_column.add_child(MetroStyle.label("TAP KOMBOSU", 8, MetroStyle.MUTED))
	combo_label = _display("×0", 29 if compact or landscape else 38, MetroStyle.LIME)
	combo_column.add_child(combo_label)

func _stage(parent: HBoxContainer, minimum_height: float) -> void:
	var frame := MetroStyle.panel(MetroStyle.PANEL, 17)
	frame.add_theme_stylebox_override("panel", MetroStyle.box(MetroStyle.PANEL, 17, MetroStyle.BORDER, 1))
	frame.custom_minimum_size = Vector2(190, minimum_height)
	frame.size_flags_horizontal = SIZE_EXPAND_FILL
	frame.size_flags_vertical = SIZE_EXPAND_FILL
	parent.add_child(frame)
	var holder := Control.new()
	frame.add_child(holder)
	platform = MetroPlatform.new(false)
	platform.custom_minimum_size = Vector2.ZERO
	_full(platform)
	holder.add_child(platform)
	var badge := MetroStyle.label("QAPI %d / %d" % [Metro.session.door_index + 1, Metro.session.doors_total], 9, MetroStyle.LIME)
	badge.position = Vector2(12, 10)
	badge.name = "DoorBadge"
	badge.add_theme_stylebox_override("normal", MetroStyle.box(Color("132a22"), 7, Color("34563b"), 1))
	holder.add_child(badge)
	var corner := MetroStyle.label("%02d  ·  BAKI" % (Metro.selected_station + 1), 9, Color("cad7c0"))
	corner.set_anchors_preset(PRESET_TOP_RIGHT)
	corner.offset_left = -100
	corner.offset_right = -12
	corner.offset_top = 10
	corner.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	holder.add_child(corner)
	overlay = Control.new()
	_full(overlay)
	overlay.mouse_filter = MOUSE_FILTER_IGNORE
	holder.add_child(overlay)

func _game_info(parent: HBoxContainer) -> void:
	var info := MetroStyle.vbox(12)
	info.custom_minimum_size.x = 235
	parent.add_child(info)
	var mission := MetroStyle.panel()
	info.add_child(mission)
	var column := MetroStyle.vbox(13)
	mission.add_child(column)
	column.add_child(MetroStyle.label("BU QAPININ SINAĞI", 9, MetroStyle.LIME))
	column.add_child(_display("İZDİHAMI AŞ.", 26))
	column.add_child(_wrapped("TAP ilə qarşıdakı maneəni aş. Boş zolağa keçəndə hər toxunuş daha güclü olur.", 12, MetroStyle.MUTED))
	column.add_child(_bar(Color(Metro.current_route().color)))
	column.add_child(_wrapped("Sarı saatlar: +1 / +2 saniyə.\nEnerji 60-a çatanda: Yol aç!\nPik saatda: dalğadan yayın.", 12, MetroStyle.MUTED))
	var wardrobe := MetroStyle.panel(Color("13241f"))
	var character_column := MetroStyle.vbox(5)
	wardrobe.add_child(character_column)
	character_column.add_child(MetroWardrobe.new(true))
	character_column.add_child(MetroStyle.label("%.1f GÜC  ·  ×%.2f SÜRƏT" % [Metro.player_stats().power, Metro.player_stats().speed], 10, MetroStyle.LIME))
	info.add_child(wardrobe)

func _game_controls(parent: VBoxContainer, stacked: bool = false) -> void:
	var section := MetroStyle.vbox(8)
	parent.add_child(section)
	var row: BoxContainer = MetroStyle.vbox(8) if compact or stacked else MetroStyle.hbox(12)
	section.add_child(row)
	var movement := MetroStyle.hbox(6)
	for lane in range(3):
		var lane_button := _button(["← SOL", "ORTA", "SAĞ →"][lane], "lane:" + str(lane), func() -> void: _lane(lane), false, Metro.session.lane == lane, true)
		lane_button.custom_minimum_size.x = 62 if compact or stacked else 76
		lane_button.size_flags_horizontal = SIZE_EXPAND_FILL
		movement.add_child(lane_button)
	if compact or stacked:
		row.add_child(movement)
		var actions := MetroStyle.hbox(8)
		row.add_child(actions)
		var tap := _tap_button()
		tap.size_flags_horizontal = SIZE_EXPAND_FILL
		actions.add_child(tap)
		actions.add_child(_burst_button())
	else:
		movement.size_flags_vertical = SIZE_SHRINK_CENTER
		row.add_child(movement)
		var tap := _tap_button()
		tap.size_flags_horizontal = SIZE_EXPAND_FILL
		row.add_child(tap)
		row.add_child(_burst_button())
	var status := MetroStyle.hbox(8)
	section.add_child(status)
	hint_label = _wrapped("SPACE / TAP — irəlilə  ·  Boş zolaq daha çox güc verir.", 10, MetroStyle.MUTED)
	hint_label.size_flags_horizontal = SIZE_EXPAND_FILL
	status.add_child(hint_label)
	energy_label = MetroStyle.label("0 / 100", 10, MetroStyle.LIME)
	status.add_child(energy_label)
	energy_bar = _bar(MetroStyle.LIME, 4)
	section.add_child(energy_bar)

func _tap_button() -> Button:
	var button := _button("TAP  ·  İRƏLİLƏ", "tap", _tap, true)
	button.custom_minimum_size.y = 59 if compact or landscape else 70
	button.add_theme_font_override("font", strong_font)
	button.add_theme_font_size_override("font_size", 15 if compact else 21)
	button.action_mode = BaseButton.ACTION_MODE_BUTTON_PRESS
	button.focus_mode = FOCUS_NONE
	return button

func _burst_button() -> Button:
	var button := _button("YOL AÇ\n60 ENERJİ", "burst", _burst, false)
	button.custom_minimum_size = Vector2(88 if compact or landscape else 148, 59 if compact or landscape else 70)
	button.add_theme_font_size_override("font_size", 10 if compact or landscape else 13)
	button.focus_mode = FOCUS_NONE
	return button

func _game_overlay() -> void:
	if overlay == null: return
	for child in overlay.get_children():
		overlay.remove_child(child)
		child.queue_free()
	for key in ["resume", "retry", "next", "begin", "result-shop", "route-complete"]:
		controls.erase(key)
		handlers.erase(key)
	countdown_label = null
	var mode: String = Metro.session.mode
	if mode == "playing": return
	if mode == "countdown":
		var center := CenterContainer.new()
		_full(center)
		center.mouse_filter = MOUSE_FILTER_IGNORE
		overlay.add_child(center)
		countdown_label = _display("3", 70, MetroStyle.LIME)
		center.add_child(countdown_label)
		return
	var dim := ColorRect.new()
	dim.color = Color(0.025, 0.07, 0.067, 0.66)
	_full(dim)
	dim.mouse_filter = MOUSE_FILTER_IGNORE
	overlay.add_child(dim)
	var center := CenterContainer.new()
	_full(center)
	center.mouse_filter = MOUSE_FILTER_IGNORE
	overlay.add_child(center)
	var panel := MetroStyle.panel(Color("13261f"), 17)
	panel.custom_minimum_size.x = 238 if compact or landscape else 360
	center.add_child(panel)
	var column := MetroStyle.vbox(8)
	panel.add_child(column)
	var title := "QAPI AÇILIR."
	var subtitle := "TAP et, vaxt fürsətlərini topla, vaqona keç."
	var primary := "BAŞLA  →"
	var action: Callable = _begin
	var id := "begin"
	if mode == "paused":
		title = "BİR NƏFƏS AL."
		subtitle = "Taymer dayanıb. Hazır olanda davam et."
		primary = "DAVAM ET  →"
		action = _resume
		id = "resume"
	elif mode == "lost":
		title = "BU QATAR GETDİ."
		subtitle = "Boş zolaq seç və kombo ritmini qoru."
		primary = "YENİDƏN CƏHD ET  →"
		action = _retry
		id = "retry"
	elif mode == "won":
		title = "VAQONDASAN!" if Metro.session.door_index + 1 < Metro.session.doors_total else "STANSİYA KEÇİLDİ!"
		subtitle = "+%d jeton  ·  %.1f saniyə ehtiyat" % [Metro.session.reward, Metro.session.time_left]
		primary = "NÖVBƏTİ QAPI  →" if Metro.session.door_index + 1 < Metro.session.doors_total else "NÖVBƏTİ STANSİYA  →"
		if Metro.selected_station + 1 == Metro.current_route().stations.size() and Metro.session.door_index + 1 == Metro.session.doors_total:
			primary = "MARŞRUT TAMAMLANDI  ✓"
		action = _next
		id = "next"
		var stars := MetroStyle.label("★  ".repeat(Metro.session.stars).strip_edges(), 24, MetroStyle.ORANGE)
		stars.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		column.add_child(stars)
	var headline := _display(title, 26 if compact or landscape else 38, MetroStyle.LIME if mode == "won" else MetroStyle.TEXT)
	headline.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(headline)
	var description := _wrapped(subtitle, 10 if compact or landscape else 12, MetroStyle.MUTED)
	description.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	description.custom_minimum_size.x = 210 if compact or landscape else 315
	column.add_child(description)
	var button := _button(primary, id, action, true, false, compact or landscape)
	button.custom_minimum_size.y = 40 if compact or landscape else 52
	column.add_child(button)
	if mode in ["won", "lost"]:
		var shop := _button("AVADANLIQ AL  →", "result-shop", func() -> void: _navigate("shop"), false, false, true)
		shop.custom_minimum_size.y = 32 if compact else 40
		column.add_child(shop)

func _process(delta: float) -> void:
	if ui == null: return
	if view == "play" and not modal_open:
		Metro.session.tick(delta)
		for entry in Metro.session.events:
			if platform != null: platform.event(entry)
			if entry.type == "won":
				Metro.claim_win()
				audio.play("won")
				_haptic(35)
			elif entry.type == "clear": audio.play("time" if float(entry.bonus) > 0 else "clear")
			elif entry.type in ["lost", "go", "burst"]: audio.play(entry.type)
			elif entry.type == "hazard": _show_toast(entry.text, false)
		Metro.session.events.clear()
		_update_game()
	toast_left = maxf(0, toast_left - delta)
	if toast != null: toast.visible = toast_left > 0
	browser_elapsed += delta
	if browser_elapsed >= 0.12:
		browser_elapsed = 0.0
		_browser_state()

func _update_game() -> void:
	if time_label == null or view != "play": return
	var session: MetroSession = Metro.session
	time_label.text = "%.1f s" % session.time_left
	time_label.add_theme_color_override("font_color", MetroStyle.RED if session.time_left < 2.0 else MetroStyle.ORANGE)
	timer_bar.value = clampf(session.time_left / session.initial_time * 100, 0, 100)
	obstacle_label.text = "%d / %d maneə" % [session.obstacle_index, session.obstacles.size()]
	progress_bar.value = session.progress() * 100
	combo_label.text = "×%d" % session.combo
	energy_label.text = "%d / 100" % int(session.energy)
	energy_bar.value = session.energy
	if controls.has("tap"):
		controls.tap.disabled = session.mode != "playing"
		controls.tap.text = "TAP  ·  İRƏLİLƏ" if session.burst_left <= 0 else "TAP  ·  ×2.6 GÜC!"
	if platform != null:
		var badge := platform.get_parent().get_node_or_null("DoorBadge") as Label
		if badge != null: badge.text = "QAPI %d / %d" % [session.door_index + 1, session.doors_total]
	if controls.has("burst"):
		controls.burst.disabled = session.mode != "playing" or session.energy < 60 or session.burst_cooldown > 0
		controls.burst.text = "YOL AÇ\n60 ENERJİ" if session.burst_cooldown <= 0 else "DOLDURULUR\n%.1f s" % session.burst_cooldown
	for lane in range(3):
		var key := "lane:" + str(lane)
		if controls.has(key):
			MetroStyle.button_style(controls[key], session.lane == lane, false, true)
	var obstacle := session.active_obstacle()
	if hint_label != null:
		if session.wave_active(): hint_label.text = "İZDİHAM DALĞASI! Boş zolağı tut."
		elif session.mode == "playing" and not obstacle.is_empty(): hint_label.text = obstacle.name + ("  ·  +%.0f saniyə" % obstacle.time_bonus if float(obstacle.time_bonus) > 0 else "  ·  Ritmini tut")
		else: hint_label.text = "TAP ilə irəlilə  ·  Boş zolaq daha çox güc verir."
	if last_mode != session.mode:
		last_mode = session.mode
		_game_overlay()
	if countdown_label != null: countdown_label.text = str(maxi(1, int(ceil(session.countdown / 0.5))))

func _start_run() -> void:
	if Metro.session.mode in ["paused", "won", "lost"]:
		view = "play"
		_rebuild()
		return
	Metro.prepare_station()
	view = "play"
	Metro.session.start()
	audio.play("ui")
	_rebuild()

func _begin() -> void:
	Metro.session.start()

func _tap() -> void:
	if view != "play" or modal_open: return
	if Metro.session.tap():
		audio.play("tap")
		_haptic(8)

func _lane(lane: int) -> void:
	Metro.session.change_lane(lane)

func _burst() -> void:
	Metro.session.burst()

func _pause() -> void:
	Metro.session.pause()

func _resume() -> void:
	Metro.session.stats = Metro.player_stats()
	Metro.session.resume()

func _retry() -> void:
	Metro.session.stats = Metro.player_stats()
	Metro.session.retry()
	if platform != null: platform.reset()

func _next() -> void:
	if Metro.session.door_index + 1 < Metro.session.doors_total:
		Metro.session.stats = Metro.player_stats()
		Metro.session.next_door()
	elif not Metro.advance_station():
		view = "map"
	_rebuild()

func _navigate(next_view: String) -> void:
	if view == "play" and next_view != "play": Metro.session.pause()
	view = next_view
	audio.play("ui")
	_rebuild()

func _input(event: InputEvent) -> void:
	if view != "play" or modal_open or not event is InputEventKey: return
	if not event.pressed or event.echo: return
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
	if what == NOTIFICATION_WM_CLOSE_REQUEST and ui != null: Metro.persist()

func _profile_changed() -> void:
	if coins_label != null: coins_label.text = _number(int(Metro.profile.coins))

func _purchase_message(message: String, success: bool) -> void:
	call_deferred("_show_toast", message, success)
	if success: audio.play("clear")

func _show_toast(message: String, success: bool = true) -> void:
	if toast == null: return
	toast.text = message
	toast.add_theme_color_override("font_color", MetroStyle.LIME if success else MetroStyle.ORANGE)
	toast_left = 3.3
	toast.visible = true

func _show_help() -> void:
	if modal_open: return
	if view == "play": Metro.session.pause()
	modal_open = true
	var shade := ColorRect.new()
	shade.name = "HelpOverlay"
	shade.color = Color(0.015, 0.035, 0.03, 0.86)
	_full(shade)
	ui.add_child(shade)
	var margin := MetroStyle.margin(20)
	_full(margin)
	shade.add_child(margin)
	var center := CenterContainer.new()
	margin.add_child(center)
	var panel := MetroStyle.panel(Color("14251f"), 22)
	panel.custom_minimum_size.x = minf(550, logical_size.x - 48)
	center.add_child(panel)
	var column := MetroStyle.vbox(16)
	panel.add_child(column)
	column.add_child(MetroStyle.label("BAKI METROSU  /  QISA BƏLƏDÇİ", 10, MetroStyle.LIME))
	column.add_child(_display("BİR TAP. BİR ADDIM.", 36 if compact else 46))
	for entry in [
		{"icon": "tap", "title": "01  ·  Ritmi tut", "text": "TAP düyməsinə təkrar toxun. Ardıcıl ritm kombo verir, hər toxunuş daha güclü olur."},
		{"icon": "map", "title": "02  ·  Yolunu seç", "text": "Sol, orta, sağ zolaqdan boş olanına keç. Çamadan, sərnişin və sürüşkən döşəmə tempi dəyişir."},
		{"icon": "time", "title": "03  ·  Vaxt qazan", "text": "Qapılar 5–10 saniyədə bağlanır. Sarı saat maneələrini aşanda +1 və +2 saniyə alırsan."},
		{"icon": "energy", "title": "04  ·  Gücünü istifadə et", "text": "60 enerji topla, Yol aç bacarığını işə sal. Qapıları keçib jetonlarla güc, sürət və avadanlıq al."}
	]:
		var row := MetroStyle.hbox(12)
		column.add_child(row)
		row.add_child(MetroIcon.new(entry.icon, MetroStyle.LIME, 25))
		var copy := MetroStyle.vbox(5)
		copy.size_flags_horizontal = SIZE_EXPAND_FILL
		row.add_child(copy)
		copy.add_child(MetroStyle.label(entry.title, 13))
		var text := _wrapped(entry.text, 11 if compact else 12, MetroStyle.MUTED)
		text.custom_minimum_size.x = minf(450, logical_size.x - 130)
		copy.add_child(text)
	column.add_child(_button("HAZIRAM  →", "close-help", func() -> void:
		modal_open = false
		ui.remove_child(shade)
		shade.queue_free()
		controls.erase("close-help")
		handlers.erase("close-help"), true))

func _haptic(duration: int) -> void:
	if not Metro.profile.settings.haptics: return
	if OS.has_feature("web"):
		JavaScriptBridge.eval("if(navigator.vibrate) navigator.vibrate(%d);" % duration)
	elif OS.has_feature("mobile"): Input.vibrate_handheld(duration)

func _browser_action(arguments: Array) -> void:
	if arguments.is_empty() or not arguments[0] is String: return
	var id: String = arguments[0]
	if not controls.has(id) or not handlers.has(id): return
	var button: Button = controls[id]
	if not is_instance_valid(button) or button.disabled or not button.is_visible_in_tree(): return
	handlers[id].call()

func _browser_state() -> void:
	if not OS.has_feature("web") or ui == null: return
	var buttons := {}
	for id in controls:
		var button: Button = controls[id]
		if not is_instance_valid(button) or not button.is_visible_in_tree(): continue
		if modal_open and id != "close-help": continue
		var rect := button.get_global_rect()
		buttons[id] = {"x": rect.position.x, "y": rect.position.y, "width": rect.size.x, "height": rect.size.y, "disabled": button.disabled, "text": button.text if not button.text.is_empty() else button.tooltip_text}
	var state := {
		"ready": true, "engine": "Godot", "view": view, "route": Metro.selected_route,
		"station": Metro.current_station().short, "coins": Metro.profile.coins, "xp": Metro.profile.xp,
		"doors_completed": Metro.profile.total_doors, "completed_stations": Metro.completed_stations(),
		"unique_stations": Metro.unique_stations(), "upgrades": Metro.profile.upgrades,
		"owned": Metro.profile.owned, "equipped": Metro.profile.equipped,
		"route_progress": Metro.profile.route_progress, "settings": Metro.profile.settings,
		"session": Metro.session.snapshot(), "stats": Metro.player_stats(), "buttons": buttons,
		"viewport": {"width": get_viewport_rect().size.x, "height": get_viewport_rect().size.y},
		"modal": modal_open, "save_ok": Metro.save_ok
	}
	JavaScriptBridge.eval("window.__metroState=" + JSON.stringify(state) + ";if(window.metroAccessibility)window.metroAccessibility(window.__metroState);", true)

func _button(text: String, id: String, action: Callable, primary: bool = false, active: bool = false, small: bool = false) -> Button:
	var button := Button.new()
	button.text = text
	button.pressed.connect(action)
	MetroStyle.button_style(button, active, primary, small)
	controls[id] = button
	handlers[id] = action
	return button

func _display(text: String, font_size: int, color: Color = MetroStyle.TEXT) -> Label:
	var label := MetroStyle.label(text, font_size, color)
	label.add_theme_font_override("font", display_font)
	return label

func _wrapped(text: String, font_size: int = 14, color: Color = MetroStyle.TEXT) -> Label:
	var label := MetroStyle.label(text, font_size, color)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.size_flags_horizontal = SIZE_EXPAND_FILL
	return label

func _stat(icon: String, title: String, value: String, color: Color) -> PanelContainer:
	var panel := MetroStyle.panel(Color("182820"), 12)
	panel.size_flags_horizontal = SIZE_EXPAND_FILL
	var column := MetroStyle.vbox(5)
	panel.add_child(column)
	var row := MetroStyle.hbox(6)
	row.add_child(MetroIcon.new(icon, color, 16))
	row.add_child(MetroStyle.label(title, 8, MetroStyle.MUTED))
	column.add_child(row)
	column.add_child(_display(value, 25, color))
	return panel

func _bar(color: Color, height: int = 5) -> ProgressBar:
	var bar := ProgressBar.new()
	bar.custom_minimum_size.y = height
	bar.show_percentage = false
	bar.mouse_filter = MOUSE_FILTER_IGNORE
	bar.add_theme_stylebox_override("background", MetroStyle.slim_box(Color("2b3d32"), height / 2))
	bar.add_theme_stylebox_override("fill", MetroStyle.slim_box(color, height / 2))
	return bar

func _full(control: Control) -> void:
	control.set_anchors_and_offsets_preset(PRESET_FULL_RECT)

func _number(value: int) -> String:
	var text := str(value)
	var output := ""
	for index in range(text.length()):
		if index > 0 and (text.length() - index) % 3 == 0: output += " "
		output += text[index]
	return output
