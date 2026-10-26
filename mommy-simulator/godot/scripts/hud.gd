class_name WorldHUD
extends CanvasLayer

signal interact
signal move_changed(value: Vector2)
signal look_changed(value: Vector2)
signal jump
signal crouch
signal camera_changed
signal sprint(value: bool)
signal action_play(id: String)
signal mission_requested
signal destination_requested(id: String)
signal capture_requested
signal panel_changed(open: bool)

var root := Control.new()
var room_label := Label.new()
var clock_label := Label.new()
var wallet_label := Label.new()
var mission_label := Label.new()
var prompt_button := Button.new()
var status_label := Label.new()
var motion_label := Label.new()
var joystick: Control
var stick := Vector2.ZERO
var joystick_id := -1
var look_id := -1
var look_last := Vector2.ZERO
var panel: PanelContainer
var panel_content: VBoxContainer
var panel_title: Label
var panel_scroll: ScrollContainer
var toast_timer := 0.0
var modal := false
var current_panel := ""
var show_joystick := true
var theme := Theme.new()
var target: WorldInteractable
var task_locked := false
var top_info: PanelContainer
var controls_visible := true
var action_buttons: Array[Button] = []
var hint := ""
var current_room := ""

func _ready() -> void:
	root.set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
	theme.default_font_size = 15
	theme.default_font = load("res://assets/details/Manrope.ttf")
	theme.set_color("font_color", "Label", Color("faf4e7"))
	theme.set_color("font_color", "Button", Color("faf4e7"))
	theme.set_color("font_hover_color", "Button", Color.WHITE)
	theme.set_color("font_disabled_color", "Button", Color("89958a"))
	for name in ["normal", "hover", "pressed", "disabled", "focus"]:
		var colour := Color("273e36") if name == "normal" else Color("49614b") if name != "disabled" else Color("283831")
		colour.a = .94
		theme.set_stylebox(name, "Button", style(colour, 12))
	root.theme = theme
	build_top()
	build_controls()
	build_mission()
	Life.changed.connect(refresh)
	Life.completed.connect(func(id: String) -> void: toast(Life.tr_copy(Life.activities[id].result)))
	get_viewport().size_changed.connect(layout)
	layout()
	refresh()
	if not Life.state.started:
		welcome()

func c(az: String, en: String, tr: String) -> String:
	return Life.tr_copy([az, en, tr])

func style(colour: Color, radius := 14) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = colour
	box.set_corner_radius_all(radius)
	box.set_content_margin_all(12)
	box.border_color = Color(1, 1, 1, .12)
	box.set_border_width_all(1)
	return box

func button(title: String, callback: Callable, container: Node = root) -> Button:
	var node := Button.new()
	node.text = title
	node.custom_minimum_size = Vector2(0, 44)
	node.pressed.connect(callback)
	container.add_child(node)
	return node

func label(title: String, size := 15, container: Node = root) -> Label:
	var node := Label.new()
	node.text = title
	node.add_theme_font_size_override("font_size", size)
	container.add_child(node)
	return node

func build_top() -> void:
	var top := HBoxContainer.new()
	top.name = "Top"
	top.add_theme_constant_override("separation", 12)
	root.add_child(top)
	var info := PanelContainer.new()
	top_info = info
	info.add_theme_stylebox_override("panel", style(Color(.09, .16, .13, .78)))
	info.custom_minimum_size = Vector2(238, 76)
	top.add_child(info)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 3)
	info.add_child(column)
	label("MOMMY  /  LUZERN", 13, column).add_theme_color_override("font_color", Color("c8d7b1"))
	column.add_child(room_label)
	room_label.add_theme_font_size_override("font_size", 19)
	var row := HBoxContainer.new()
	column.add_child(row)
	row.add_child(clock_label)
	row.add_child(wallet_label)
	row.add_theme_constant_override("separation", 16)
	var grow := Control.new()
	grow.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(grow)
	for item in [["Xəritə", "Map", "Harita", "map"], ["Günüm", "My day", "Günüm", "day"], ["Ailə", "Family", "Aile", "family"], ["Foto", "Photo", "Fotoğraf", "photo"], ["⋮", "⋮", "⋮", "settings"]]:
		var id: String = item[3]
		var b := button(c(item[0], item[1], item[2]), func() -> void: capture_requested.emit() if id == "photo" else show_panel(id), top)
		b.custom_minimum_size.y = 44
		b.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	root.add_child(status_label)
	status_label.add_theme_font_size_override("font_size", 13)
	status_label.text = c("Ərzaq, paltarlar və ailə ehtiyacları bu dünyada yaşayır.", "Supplies, laundry and family needs live in this world.", "Malzemeler, çamaşırlar ve aile ihtiyaçları bu dünyada yaşıyor.")
	status_label.add_theme_color_override("font_color", Color("d6ddc9"))
	root.add_child(motion_label)
	motion_label.add_theme_font_size_override("font_size", 12)

func build_controls() -> void:
	joystick = Control.new()
	joystick.name = "Joystick"
	joystick.custom_minimum_size = Vector2(160, 160)
	joystick.mouse_filter = Control.MOUSE_FILTER_IGNORE
	joystick.draw.connect(func() -> void:
		joystick.draw_circle(Vector2(80, 80), 65, Color(.10, .17, .14, .32))
		joystick.draw_arc(Vector2(80, 80), 65, 0, TAU, 60, Color(.93, .94, .85, .35), 2, true)
		joystick.draw_circle(Vector2(80, 80) + stick * 44, 27, Color(.78, .85, .66, .7))
	)
	root.add_child(joystick)
	var controls := VBoxContainer.new()
	controls.name = "Actions"
	controls.add_theme_constant_override("separation", 8)
	root.add_child(controls)
	action_buttons.append(button(c("Atıl", "Jump", "Zıpla"), func() -> void: jump.emit(), controls))
	action_buttons.append(button(c("Əyil", "Crouch", "Eğil"), func() -> void: crouch.emit(), controls))
	action_buttons.append(button("1P / 3P", func() -> void: camera_changed.emit(), controls))
	var run := button(c("Sürətli addım", "Quick pace", "Hızlı adım"), func() -> void: pass, controls)
	run.button_down.connect(func() -> void: sprint.emit(true))
	run.button_up.connect(func() -> void: sprint.emit(false))
	action_buttons.append(run)
	for b in action_buttons:
		b.custom_minimum_size = Vector2(106, 40)
		b.add_theme_font_size_override("font_size", 13)
	root.add_child(prompt_button)
	prompt_button.custom_minimum_size = Vector2(232, 55)
	prompt_button.pressed.connect(func() -> void: interact.emit())
	prompt_button.add_theme_stylebox_override("normal", style(Color(.25, .36, .23, .94)))
	prompt_button.add_theme_font_size_override("font_size", 17)
	root.draw.connect(func() -> void:
		var center := root.size * .5
		root.draw_circle(center, 2.4, Color(1, 1, .94, .7))
		root.draw_arc(center, 8, 0, TAU, 32, Color(1, 1, .94, .45), 1, true)
	)

func build_mission() -> void:
	var mission := PanelContainer.new()
	mission.name = "Mission"
	mission.add_theme_stylebox_override("panel", style(Color(.08, .15, .11, .82)))
	root.add_child(mission)
	var row := HBoxContainer.new()
	mission.add_child(row)
	mission_label.custom_minimum_size = Vector2(260, 0)
	mission_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	row.add_child(mission_label)
	button("→", func() -> void: mission_requested.emit(), row)

func layout() -> void:
	var size := get_viewport().get_visible_rect().size
	root.size = size
	var top := root.get_node("Top") as HBoxContainer
	top.position = Vector2(24, 20)
	top.size = Vector2(size.x - 48, 76)
	joystick.position = Vector2(25, size.y - 190)
	root.get_node("Actions").position = Vector2(size.x - 132, size.y - 228)
	prompt_button.position = Vector2(size.x * .5 - 116, size.y - 83)
	var mission := root.get_node("Mission") as PanelContainer
	mission.position = Vector2(25, size.y - 277)
	mission.size = Vector2(320, 66)
	status_label.position = Vector2(27, 106)
	status_label.size.x = size.x - 55
	status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	motion_label.position = Vector2(27, size.y - 27)
	root.queue_redraw()
	joystick.queue_redraw()
	if panel:
		panel.position = Vector2(size.x - minf(530, size.x - 32) - 16, 16)
		panel.size = Vector2(minf(530, size.x - 32), size.y - 32)

func set_room(id: String) -> void:
	if current_room == id:
		return
	current_room = id
	var names := {"living": ["Qonaq otağı", "Living room", "Oturma odası"], "kitchen": ["Mətbəx", "Kitchen", "Mutfak"], "nursery": ["Körpə otağı", "Nursery", "Bebek odası"],
		"bedroom": ["Yataq otağı", "Bedroom", "Yatak odası"], "bathroom": ["Hamam", "Bathroom", "Banyo"], "garden": ["Gölə baxan terras", "Lakeview terrace", "Göl manzaralı teras"],
		"market": ["Məhəllə marketi", "Local market", "Mahalle marketi"], "cafe": ["Göl kafesi", "Lake café", "Göl kafesi"], "clinic": ["Anacan klinika", "Anacan clinic", "Anacan klinik"],
		"lakeside": ["Luzern gölü", "Lake Lucerne", "Luzern Gölü"], "town": ["Luzern məhəlləsi", "Lucerne neighbourhood", "Luzern mahallesi"]}
	room_label.text = Life.tr_copy(names.get(id, names.town))

func set_target(object: WorldInteractable, seated := false, holding := false) -> void:
	target = object
	prompt_button.disabled = not object and not seated and not holding
	prompt_button.text = c("Ayağa qalx", "Stand up", "Ayağa kalk") if seated else c("Əşyanı yerə qoy", "Put object down", "Eşyayı yere koy") if holding else object.prompt() if object else c("Əşyaya yaxınlaş", "Approach an object", "Eşyaya yaklaş")
	prompt_button.visible = not task_locked and (object != null or seated or holding)

func refresh() -> void:
	if not Life.state.has("time"):
		return
	clock_label.text = "%02d:%02d  ·  %s %d" % [int(Life.state.time) / 60, int(Life.state.time) % 60, c("Gün", "Day", "Gün"), int(Life.state.day)]
	wallet_label.text = "CHF %.2f" % (float(Life.state.household.cash) / 100)
	var step := Life.current_step()
	var progress := Life.progress()
	mission_label.text = "%s  ·  %d/%d\n%s" % [c("HEKAYƏ", "STORY", "HİKÂYE"), progress.x, progress.y, Life.tr_copy(step.title) if not step.is_empty() else c("Fəsil tamamlandı", "Chapter complete", "Bölüm tamamlandı")]
	if Life.state.activity != null:
		prompt_button.visible = false
		mission_label.text = Life.tr_copy(Life.activities[Life.state.activity.id].title) + "…"

func toast(message: String) -> void:
	status_label.text = message
	toast_timer = 5.0

func _process(delta: float) -> void:
	if toast_timer > 0:
		toast_timer -= delta
		if toast_timer <= 0:
			status_label.text = c("Sol tərəf: hərəkət  ·  Sağ tərəf: kamera  ·  E: qarşılıqlı əlaqə", "Left: move  ·  Right: camera  ·  E: interact", "Sol: hareket  ·  Sağ: kamera  ·  E: etkileşim")
	motion_label.text = "%s  %d%%  ·  %s  %d%%  ·  %s  %d%%" % [c("Enerji", "Energy", "Enerji"), int(Life.state.needs.energy), c("Qida", "Food", "Beslenme"), int(Life.state.needs.food), c("Əhval", "Mood", "Ruh hâli"), int(Life.state.needs.mood)]

func _input(event: InputEvent) -> void:
	if modal or task_locked or Life.acceptance:
		return
	if event is InputEventScreenTouch:
		if event.pressed:
			if Rect2(joystick.position, Vector2(160, 160)).has_point(event.position) and joystick_id == -1:
				joystick_id = event.index
				set_stick(event.position)
				get_viewport().set_input_as_handled()
			elif event.position.x > root.size.x * .42 and event.position.y > 128 and event.position.y < root.size.y - 90 and not (root.get_node("Actions") as Control).get_global_rect().has_point(event.position):
				look_id = event.index
				look_last = event.position
		else:
			if event.index == joystick_id:
				joystick_id = -1
				stick = Vector2.ZERO
				move_changed.emit(stick)
				joystick.queue_redraw()
			if event.index == look_id:
				look_id = -1
	if event is InputEventScreenDrag:
		if event.index == joystick_id:
			set_stick(event.position)
			get_viewport().set_input_as_handled()
		elif event.index == look_id:
			look_changed.emit(event.relative)
	if event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT):
		look_changed.emit(event.relative)
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed and Rect2(joystick.position, Vector2(160, 160)).has_point(event.position):
			joystick_id = 100
			set_stick(event.position)
		elif not event.pressed and joystick_id == 100:
			joystick_id = -1
			stick = Vector2.ZERO
			move_changed.emit(stick)
			joystick.queue_redraw()
	if event is InputEventMouseMotion and joystick_id == 100:
		set_stick(event.position)

func set_stick(position: Vector2) -> void:
	stick = ((position - joystick.position - Vector2(80, 80)) / 55).limit_length(1)
	move_changed.emit(stick)
	joystick.queue_redraw()

func open_panel(title: String) -> void:
	if task_locked:
		return
	close_panel()
	modal = true
	stick = Vector2.ZERO
	joystick_id = -1
	look_id = -1
	move_changed.emit(Vector2.ZERO)
	sprint.emit(false)
	panel = PanelContainer.new()
	panel.add_theme_stylebox_override("panel", style(Color(.10, .17, .13, .97), 18))
	root.add_child(panel)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 14)
	panel.add_child(column)
	var heading := HBoxContainer.new()
	column.add_child(heading)
	panel_title = label(title, 23, heading)
	panel_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button("×", close_panel, heading)
	panel_scroll = ScrollContainer.new()
	panel_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(panel_scroll)
	panel_content = VBoxContainer.new()
	panel_content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel_content.add_theme_constant_override("separation", 12)
	panel_scroll.add_child(panel_content)
	panel_changed.emit(true)
	layout()

func close_panel() -> void:
	if panel:
		root.remove_child(panel)
		panel.queue_free()
		panel = null
	modal = false
	current_panel = ""
	panel_changed.emit(false)

func paragraph(value: String) -> Label:
	var node := label(value, 14, panel_content)
	node.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	node.add_theme_color_override("font_color", Color("c6d0b8"))
	return node

func show_panel(id: String) -> void:
	if task_locked:
		return
	open_panel({"map": c("Luzern xəritəsi", "Lucerne map", "Luzern haritası"), "day": c("Günlük həyat", "Daily life", "Günlük hayat"), "family": c("Ailəm", "My family", "Ailem"), "settings": c("Ayarlar", "Settings", "Ayarlar"), "album": c("Xatirələr", "Memories", "Anılar")}.get(id, id))
	current_panel = id
	match id:
		"map":
			paragraph(c("Məkanlara küçə ilə gəzərək də çata bilərsən. Qapıya yaxınlaş, aç və içəri gir.", "You can also walk through the neighbourhood. Approach a door, open it and step inside.", "Mekânlara mahallede yürüyerek de ulaşabilirsin. Kapıya yaklaş, aç ve içeri gir."))
			for location in ["home", "market", "cafe", "clinic", "lakeside"]:
				var name: String = {"home": "Lakeview House", "market": "Quartiermarkt", "cafe": "Lake Café", "clinic": "Anacan Clinic", "lakeside": "Luzern / Kapellbrücke"}[location]
				button(name + "  →", func() -> void: close_panel(); destination_requested.emit(location), panel_content)
		"day":
			paragraph("CHF %.2f  ·  %s %d%%" % [float(Life.state.household.cash) / 100, c("Səliqə", "Cleanliness", "Temizlik"), int(Life.state.household.cleanliness)])
			for goal in Life.daily_goals():
				var id2: String = goal
				var done: bool = id2 in Life.state.household.chores
				var b := button(("✓  " if done else "○  ") + Life.tr_copy(Life.activities[id2].title), func() -> void: close_panel(); action_play.emit(id2), panel_content)
				b.disabled = done
			var claim := button(c("Günün hədiyyəsi +45", "Daily gift +45", "Günün hediyesi +45"), func() -> void: Life.dispatch({"type": "CLAIM_LIFE_DAY"}); show_panel("day"), panel_content)
			claim.disabled = int(Life.state.household.dailyRewardDay) == int(Life.state.day) or not Life.daily_goals().all(func(goal: String) -> bool: return goal in Life.state.household.chores)
			paragraph(c("Ərzaq ehtiyatı", "Pantry", "Gıda stoğu"))
			for product in Life.definitions.groceries:
				paragraph("%s  ·  %d" % [Life.tr_copy(product.title), int(Life.state.household.groceries[product.id])])
			paragraph("%s %d  ·  %s %d" % [c("Yuyulacaq", "To wash", "Yıkanacak"), int(Life.state.household.laundry.dirty), c("Qatlanmış", "Folded", "Katlanmış"), int(Life.state.household.laundry.folded)])
			var sleep := button(c("Günü tamamla", "Finish the day", "Günü tamamla"), func() -> void: Life.dispatch({"type": "SLEEP"}); close_panel(), panel_content)
			sleep.disabled = int(Life.state.dailyActions) < 3
			button(c("Xatirə albomu", "Memory album", "Anı albümü"), func() -> void: show_panel("album"), panel_content)
		"family":
			paragraph("%s  /  %s" % [str(Life.state.avatar.name), str(Life.state.avatar.babyName)])
			for id2 in ["talk", "help"]:
				button(Life.tr_copy(Life.activities[id2].title), func() -> void: close_panel(); action_play.emit(id2), panel_content)
			var name := LineEdit.new()
			name.text = str(Life.state.avatar.name)
			name.max_length = 24
			panel_content.add_child(name)
			button(c("Adı saxla", "Save name", "İsmi kaydet"), func() -> void:
				var avatar: Dictionary = Life.state.avatar.duplicate(true)
				avatar.name = name.text.strip_edges()
				Life.dispatch({"type": "AVATAR", "avatar": avatar})
			, panel_content)
			paragraph(c("Personaj rəngləri", "Character colours", "Karakter renkleri"))
			for property in ["skin", "hair", "outfit"]:
				var row := HBoxContainer.new()
				panel_content.add_child(row)
				var colours: Array = Life.SKINS if property == "skin" else Life.HAIRS if property == "hair" else Life.OUTFITS
				for colour in colours:
					var swatch := button("●", func() -> void:
						var avatar: Dictionary = Life.state.avatar.duplicate(true)
						avatar[property] = colour
						Life.dispatch({"type": "AVATAR", "avatar": avatar})
					, row)
					swatch.add_theme_color_override("font_color", Color(colour))
					swatch.add_theme_font_size_override("font_size", 26)
		"settings":
			for language in ["az", "en", "tr"]:
				button({"az": "Azərbaycan", "en": "English", "tr": "Türkçe"}[language], func() -> void: Life.dispatch({"type": "LANGUAGE", "language": language}); show_panel("settings"), panel_content)
			paragraph(c("Qrafika profili", "Graphics profile", "Grafik profili"))
			for quality in ["balanced", "high"]:
				button(("✓ " if Life.world.quality == quality else "") + c("Balanslı", "Balanced", "Dengeli") if quality == "balanced" else c("Yüksək", "High", "Yüksek"), func() -> void:
					Life.world.quality = quality
					Life.changed.emit()
					Life.save_game()
					show_panel("settings")
				, panel_content)
			button(c("Xatirələr", "Memories", "Anılar"), func() -> void: show_panel("album"), panel_content)
			paragraph(c("WASD və ya sol joystick: hərəkət\nSağ sürüşdürmə / sağ mouse: kamera\nE: qarşılıqlı əlaqə\nShift: sürətli addım\nSpace: atılma", "WASD or left joystick: move\nRight swipe / right mouse: camera\nE: interact\nShift: quick pace\nSpace: jump", "WASD veya sol joystick: hareket\nSağ kaydırma / sağ mouse: kamera\nE: etkileşim\nShift: hızlı adım\nSpace: zıplama"))
		"album":
			for memory in Life.state.memories:
				label(Life.tr_copy(memory.title), 17, panel_content)
				if memory.has("nativePhoto") and FileAccess.file_exists(memory.nativePhoto):
					var picture := TextureRect.new()
					picture.texture = ImageTexture.create_from_image(Image.load_from_file(memory.nativePhoto))
					picture.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
					picture.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
					picture.custom_minimum_size = Vector2(420, 240)
					panel_content.add_child(picture)
				paragraph(Life.tr_copy(memory.description))

func welcome() -> void:
	open_panel("Mommy Simulator 3D")
	paragraph(c("Luzerndə öz ailə dünyana daxil ol. Ana personajını sərbəst idarə et, əşyalara yaxınlaş və hər anı dünyada yaşa.", "Step into your family world in Lucerne. Control your character freely, approach objects and live each moment in the world.", "Luzern’de aile dünyana gir. Karakterini özgürce yönet, eşyalara yaklaş ve her anı dünyada yaşa."))
	var name := LineEdit.new()
	name.placeholder_text = c("Oyundakı adın", "Your in-game name", "Oyundaki adın")
	name.text = str(Life.state.avatar.name)
	name.max_length = 24
	panel_content.add_child(name)
	for option in [[0, "Hamiləlikdən başla", "Begin with pregnancy", "Hamilelikle başla"], [10, "Ailə həyatını sına", "Try family life", "Aile hayatını dene"]]:
		var index: int = option[0]
		button(c(option[1], option[2], option[3]), func() -> void:
			var avatar: Dictionary = Life.state.avatar.duplicate(true)
			avatar.name = name.text.strip_edges().left(24)
			Life.dispatch({"type": "START", "avatar": avatar, "chapter": index, "language": Life.state.language})
			close_panel()
			destination_requested.emit(str(Life.state.location))
		, panel_content)

func set_task_lock(value: bool) -> void:
	task_locked = value
	joystick_id = -1
	look_id = -1
	stick = Vector2.ZERO
	move_changed.emit(Vector2.ZERO)
	sprint.emit(false)
	joystick.queue_redraw()
	joystick.visible = not value
	(root.get_node("Actions") as Control).visible = not value
	(root.get_node("Mission") as Control).visible = not value
	for child in root.get_node("Top").get_children():
		if child is Button:
			child.visible = not value
